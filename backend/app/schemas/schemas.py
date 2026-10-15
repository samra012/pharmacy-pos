from pydantic import BaseModel, ConfigDict, Field, field_serializer, computed_field
from typing import Optional, List
from datetime import date, datetime, timezone

from app.timezone_utils import local_today


# ---------- Product Batch ----------
class BatchCreate(BaseModel):
    batch_number: str
    expiry_date: date
    quantity: int


class BatchOut(BaseModel):
    id: int
    batch_number: str
    expiry_date: date
    quantity: int

    class Config:
        from_attributes = True

    @computed_field
    @property
    def is_expired(self) -> bool:
        return self.expiry_date < local_today()


# ---------- Product ----------
class ProductCreate(BaseModel):
    name: str
    category: Optional[str] = None
    price: float
    requires_prescription: bool = False
    reorder_level: int = 10
    # Optionally create the first batch at the same time as the product
    initial_batch: Optional[BatchCreate] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    requires_prescription: Optional[bool] = None
    reorder_level: Optional[int] = None


class ProductOut(BaseModel):
    id: int
    name: str
    category: Optional[str] = None
    price: float
    requires_prescription: bool
    reorder_level: int
    batches: List[BatchOut] = []
    total_stock: int = 0  # computed: sum of all batch quantities

    class Config:
        from_attributes = True


# ---------- Sale ----------
class SaleItemIn(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)


class SaleCreate(BaseModel):
    items: List[SaleItemIn]
    tax_rate: float = 0.0


class SaleItemOut(BaseModel):
    product_id: int
    product_name: str
    batch_id: Optional[int]
    batch_number: Optional[str] = None
    quantity: int
    unit_price: float

    class Config:
        from_attributes = True


class SaleOut(BaseModel):
    id: int
    total: float
    tax: float
    created_at: datetime
    user_id: Optional[int] = None
    cashier_username: Optional[str] = None
    items: List[SaleItemOut]

    class Config:
        from_attributes = True

    @field_serializer("created_at")
    def serialize_created_at(self, dt: datetime, _info):
        # dt is naive UTC (see timezone_utils.py and models.py). Explicitly mark it
        # as UTC when serializing, so clients like JavaScript's `new Date(...)`
        # don't misinterpret the naive string as local time.
        return dt.replace(tzinfo=timezone.utc).isoformat()


# ---------- Alerts ----------
class LowStockAlert(BaseModel):
    product_id: int
    product_name: str
    total_stock: int
    reorder_level: int


class ExpiryAlert(BaseModel):
    product_id: int
    product_name: str
    batch_id: int
    batch_number: str
    expiry_date: date
    quantity: int
    days_until_expiry: int


# ---------- Reports ----------
class DailySalesReport(BaseModel):
    date: str
    total_sales: float
    transaction_count: int


class TopItem(BaseModel):
    product_id: int
    product_name: str
    total_quantity_sold: int


# ---------- Store settings ----------
class StoreSettingsUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    store_name: str = Field(min_length=1, max_length=80)
    address: str = Field(default="", max_length=200)
    phone: str = Field(default="", max_length=40)
    receipt_footer: str = Field(default="", max_length=200)


class StoreSettingsOut(BaseModel):
    store_name: str
    address: str
    phone: str
    receipt_footer: str

    class Config:
        from_attributes = True
