from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Boolean, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


def _utcnow():
    """Naive UTC timestamp, set in Python rather than by the database so it's
    stored in the same format SQLAlchemy uses for query parameters. (SQLite
    compares datetimes as text, so a CURRENT_TIMESTAMP value without
    microseconds wouldn't compare correctly against report date bounds.)"""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Product(Base):
    """A medicine/item the pharmacy sells. Stock itself lives in ProductBatch,
    since pharmacies need to track expiry per batch, not just a single total."""
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String)
    price = Column(Float, nullable=False)
    requires_prescription = Column(Boolean, default=False)
    reorder_level = Column(Integer, default=10)  # low-stock alert threshold

    batches = relationship("ProductBatch", back_populates="product", cascade="all, delete")


class ProductBatch(Base):
    """One received batch of a product. A product can have several batches
    with different expiry dates on the shelf at once."""
    __tablename__ = "product_batches"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    batch_number = Column(String, nullable=False)
    expiry_date = Column(Date, nullable=False)
    quantity = Column(Integer, nullable=False, default=0)

    product = relationship("Product", back_populates="batches")


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    total = Column(Float, nullable=False)
    tax = Column(Float, default=0.0)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # who made the sale

    items = relationship("SaleItem", back_populates="sale", cascade="all, delete")
    user = relationship("User")

    @property
    def cashier_username(self):
        return self.user.username if self.user else None


class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    batch_id = Column(Integer, ForeignKey("product_batches.id"))  # which batch it was sold from
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)

    sale = relationship("Sale", back_populates="items")
    product = relationship("Product")
    batch = relationship("ProductBatch")

    @property
    def product_name(self):
        return self.product.name if self.product else None

    @property
    def batch_number(self):
        return self.batch.batch_number if self.batch else None


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # "cashier" or "manager"
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow)


class StoreSettings(Base):
    """Single-row table (id is always 1) holding details printed on receipts."""
    __tablename__ = "store_settings"

    id = Column(Integer, primary_key=True)
    store_name = Column(String, nullable=False, default="Pharmacy")
    address = Column(String, nullable=False, default="")
    phone = Column(String, nullable=False, default="")
    receipt_footer = Column(String, nullable=False, default="Thank you for your visit!")
