from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.models import Product, ProductBatch, Sale, SaleItem, User
from app.schemas.schemas import SaleCreate, SaleOut
from app.timezone_utils import local_today

router = APIRouter(
    prefix="/sales",
    tags=["sales"],
    dependencies=[Depends(get_current_user)],
)


@router.post("/", response_model=SaleOut, status_code=201)
def checkout(
    sale_in: SaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not sale_in.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    # Combine quantities per product first, so multiple cart lines for the same
    # product are checked and deducted against each other, not independently.
    quantities_by_product = {}
    for item in sale_in.items:
        quantities_by_product[item.product_id] = quantities_by_product.get(item.product_id, 0) + item.quantity

    today = local_today()
    subtotal = 0.0
    deductions = []  # (product, batch, quantity_from_this_batch, unit_price)

    for product_id, quantity in quantities_by_product.items():
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {product_id} not found")

        # Only unexpired batches are sellable.
        sellable_batches = [b for b in product.batches if b.quantity > 0 and b.expiry_date >= today]
        total_available = sum(b.quantity for b in sellable_batches)
        if total_available < quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough non-expired stock for '{product.name}' (have {total_available}, need {quantity})",
            )

        # FEFO: sell from the batch expiring soonest first, among non-expired batches only.
        remaining = quantity
        for batch in sorted(sellable_batches, key=lambda b: b.expiry_date):
            if remaining <= 0:
                break
            take = min(batch.quantity, remaining)
            deductions.append((product, batch, take, product.price))
            subtotal += product.price * take
            remaining -= take

    tax = round(subtotal * sale_in.tax_rate, 2)
    total = round(subtotal + tax, 2)

    sale = Sale(total=total, tax=tax, user_id=current_user.id)
    db.add(sale)
    db.flush()

    for product, batch, qty, unit_price in deductions:
        db.add(SaleItem(
            sale_id=sale.id,
            product_id=product.id,
            batch_id=batch.id,
            quantity=qty,
            unit_price=unit_price,
        ))
        batch.quantity -= qty

    db.commit()
    db.refresh(sale)

    return sale


@router.post("/check-prescriptions")
def check_prescriptions(sale_in: SaleCreate, db: Session = Depends(get_db)):
    """Lets the cashier screen warn before checkout if any cart item needs a prescription."""
    flagged = []
    for item in sale_in.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if product and product.requires_prescription:
            flagged.append({"product_id": product.id, "product_name": product.name})
    return {"requires_prescription": flagged}


@router.get("/", response_model=List[SaleOut])
def list_sales(db: Session = Depends(get_db)):
    return db.query(Sale).order_by(Sale.created_at.desc()).all()


@router.get("/{sale_id}", response_model=SaleOut)
def get_sale(sale_id: int, db: Session = Depends(get_db)):
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    return sale
