from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.auth.dependencies import get_current_user, require_role
from app.database import get_db
from app.models.models import Product, ProductBatch, SaleItem, User
from app.schemas.schemas import ProductCreate, ProductUpdate, ProductOut, BatchCreate, BatchOut
from app.timezone_utils import local_today

router = APIRouter(
    prefix="/products",
    tags=["products"],
    dependencies=[Depends(get_current_user)],  # every route needs a logged-in user
)


def _to_out(product: Product) -> ProductOut:
    """Build the response manually so we can include the computed total_stock.
    Only counts non-expired batches, matching the rule used in checkout and
    the low-stock report — expired stock isn't usable, so it shouldn't count
    as available stock anywhere in the app."""
    today = local_today()
    out = ProductOut.model_validate(product)
    out.total_stock = sum(b.quantity for b in product.batches if b.expiry_date >= today)
    return out


@router.get("/", response_model=List[ProductOut])
def list_products(db: Session = Depends(get_db)):
    products = db.query(Product).all()
    return [_to_out(p) for p in products]


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return _to_out(product)


@router.post("/", response_model=ProductOut, status_code=201)
def create_product(
    product: ProductCreate,
    db: Session = Depends(get_db),
    _manager: User = Depends(require_role("manager")),
):
    data = product.model_dump(exclude={"initial_batch"})
    db_product = Product(**data)
    db.add(db_product)
    db.flush()  # get db_product.id before committing

    if product.initial_batch:
        db.add(ProductBatch(
            product_id=db_product.id,
            batch_number=product.initial_batch.batch_number,
            expiry_date=product.initial_batch.expiry_date,
            quantity=product.initial_batch.quantity,
        ))

    db.commit()
    db.refresh(db_product)
    return _to_out(db_product)


@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    updates: ProductUpdate,
    db: Session = Depends(get_db),
    _manager: User = Depends(require_role("manager")),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return _to_out(product)


@router.delete("/{product_id}", status_code=204)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    _manager: User = Depends(require_role("manager")),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    has_sales = db.query(SaleItem).filter(SaleItem.product_id == product_id).first()
    if has_sales:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete a product that has sales history. "
                   "This protects past transactions from referencing a missing product.",
        )

    db.delete(product)
    db.commit()


# ---------- Batches (receiving new stock) ----------

@router.post("/{product_id}/batches", response_model=BatchOut, status_code=201)
def add_batch(
    product_id: int,
    batch: BatchCreate,
    db: Session = Depends(get_db),
    _manager: User = Depends(require_role("manager")),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db_batch = ProductBatch(product_id=product_id, **batch.model_dump())
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    return db_batch


@router.get("/{product_id}/batches", response_model=List[BatchOut])
def list_batches(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return db.query(ProductBatch).filter(ProductBatch.product_id == product_id).all()
