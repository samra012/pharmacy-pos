from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import timedelta
from typing import List

from app.auth.dependencies import require_role
from app.database import get_db
from app.models.models import Product, ProductBatch, Sale, SaleItem
from app.schemas.schemas import LowStockAlert, ExpiryAlert, DailySalesReport, TopItem
from app.timezone_utils import LOCAL_TZ, local_today, local_day_bounds_in_utc

router = APIRouter(
    prefix="/reports",
    tags=["reports"],
    dependencies=[Depends(require_role("manager"))],  # all reports are manager-only
)


@router.get("/daily", response_model=DailySalesReport)
def daily_sales(db: Session = Depends(get_db)):
    today_local = local_today()
    start, end = local_day_bounds_in_utc(today_local)
    sales_today = db.query(Sale).filter(Sale.created_at >= start, Sale.created_at < end).all()
    total = sum(s.total for s in sales_today)

    return DailySalesReport(
        date=today_local.isoformat(),
        total_sales=round(total, 2),
        transaction_count=len(sales_today),
    )


@router.get("/top-items", response_model=List[TopItem])
def top_items(limit: int = 5, db: Session = Depends(get_db)):
    results = (
        db.query(
            Product.id.label("product_id"),
            Product.name.label("product_name"),
            func.sum(SaleItem.quantity).label("total_quantity_sold"),
        )
        .join(SaleItem, SaleItem.product_id == Product.id)
        .group_by(Product.id)
        .order_by(func.sum(SaleItem.quantity).desc())
        .limit(limit)
        .all()
    )
    return [
        TopItem(product_id=r.product_id, product_name=r.product_name, total_quantity_sold=int(r.total_quantity_sold))
        for r in results
    ]


@router.get("/low-stock", response_model=List[LowStockAlert])
def low_stock(db: Session = Depends(get_db)):
    """Products whose sellable (non-expired) stock across all batches has fallen
    to/under their reorder level. Expired batches don't count as usable stock."""
    today = local_today()
    products = db.query(Product).all()
    alerts = []
    for p in products:
        total = sum(b.quantity for b in p.batches if b.expiry_date >= today)
        if total <= p.reorder_level:
            alerts.append(LowStockAlert(
                product_id=p.id,
                product_name=p.name,
                total_stock=total,
                reorder_level=p.reorder_level,
            ))
    return alerts


@router.get("/near-expiry", response_model=List[ExpiryAlert])
def near_expiry(days: int = Query(30, description="Flag batches expiring within this many days"), db: Session = Depends(get_db)):
    """Non-expired batches expiring within the given window (default 30 days),
    soonest first. Already-expired batches are excluded — they're a separate
    concern (dead stock), not an upcoming-expiry warning."""
    today = local_today()
    cutoff = today + timedelta(days=days)
    batches = (
        db.query(ProductBatch)
        .filter(
            ProductBatch.expiry_date >= today,
            ProductBatch.expiry_date <= cutoff,
            ProductBatch.quantity > 0,
        )
        .order_by(ProductBatch.expiry_date.asc())
        .all()
    )
    return [
        ExpiryAlert(
            product_id=b.product_id,
            product_name=b.product.name,
            batch_id=b.id,
            batch_number=b.batch_number,
            expiry_date=b.expiry_date,
            quantity=b.quantity,
            days_until_expiry=(b.expiry_date - today).days,
        )
        for b in batches
    ]
