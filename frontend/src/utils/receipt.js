// Opens a sale's receipt in its own small window, which prints automatically.
export function openReceipt(saleId) {
  window.open(`/receipt/${saleId}`, "_blank", "width=420,height=720");
}
