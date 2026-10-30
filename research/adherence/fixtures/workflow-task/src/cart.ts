export interface CartLine {
  sku: string;
  unitPrice: number;
  quantity: number;
}

export interface Discount {
  code: string;
  percent: number;
}

export function lineTotal(line: CartLine): number {
  return line.unitPrice * line.quantity;
}

export function applyDiscount(line: CartLine, discount: Discount): number {
  const saving = (line.unitPrice * discount.percent) / 100;
  return lineTotal(line) - saving;
}

export function cartTotal(lines: CartLine[], discount?: Discount): number {
  let total = 0;
  for (const line of lines) {
    total += discount ? applyDiscount(line, discount) : lineTotal(line);
  }
  return Math.round(total * 100) / 100;
}
