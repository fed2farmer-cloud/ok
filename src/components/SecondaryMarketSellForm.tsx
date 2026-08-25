import { useState } from 'react';
import { listInvestmentForSale } from '../lib/secondaryMarket';

type Props = {
  investmentId: number;
  certificateNumber: string;
  originalPrincipal: number;
  currentPrincipal: number;
  onListed?: () => void;
};

export default function SecondaryMarketSellForm(props: Props) {
  const [price, setPrice] = useState(String(Math.round(props.currentPrincipal * 100) / 100));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const asking = Number(price || 0);
  const discount = props.originalPrincipal > 0 ? (1 - asking / props.originalPrincipal) * 100 : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg('');
    try {
      await listInvestmentForSale(props.investmentId, asking);
      setMsg('Listed on the secondary market.');
      props.onListed?.();
    } catch (err: any) {
      setMsg(err?.message || 'Unable to create listing.');
    } finally { setBusy(false); }
  }

  return <form onSubmit={submit} className="secondarySellForm">
    <h3>Sell Loan Security Certificate</h3>
    <p><strong>{props.certificateNumber}</strong></p>
    <p>Original investment: <strong>${props.originalPrincipal.toFixed(2)}</strong></p>
    <p>Outstanding principal: <strong>${props.currentPrincipal.toFixed(2)}</strong></p>
    <label>Secondary market asking price
      <input type="number" min="0.01" step="0.01" required value={price} onChange={e => setPrice(e.target.value)} />
    </label>
    <p>Seller discount to original investment: <strong>{discount.toFixed(2)}%</strong></p>
    {props.originalPrincipal === 1000 && <button type="button" onClick={() => setPrice('900')}>Quick set: $900</button>}
    <button type="submit" disabled={busy || asking <= 0}>{busy ? 'Listing…' : `List for $${asking.toFixed(2)}`}</button>
    {msg && <p>{msg}</p>}
  </form>;
}
