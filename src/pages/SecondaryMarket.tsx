import { useEffect, useState } from 'react';
import { loadSecondaryListings, purchaseSecondaryListing, type SecondaryListing } from '../lib/secondaryMarket';

export default function SecondaryMarket() {
  const [rows, setRows] = useState<SecondaryListing[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  async function refresh() {
    try { setRows(await loadSecondaryListings()); }
    catch (err: any) { setMsg(err?.message || 'Unable to load secondary market.'); }
  }

  useEffect(() => { void refresh(); }, []);

  async function buy(id: string) {
    setBusy(id); setMsg('');
    try {
      const result: any = await purchaseSecondaryListing(id);
      setMsg(`Purchase completed. Certificate ${result?.certificate_number || ''} transferred.`);
      await refresh();
    } catch (err: any) { setMsg(err?.message || 'Purchase failed.'); }
    finally { setBusy(null); }
  }

  return <section className="page secondaryMarketPage">
    <span className="eyebrow">SECONDARY MARKET</span>
    <h1>Buy existing Loan Security Certificates</h1>
    <p className="lead">Sellers choose their own asking price. The sale price can be above or below the certificate's original investment or remaining principal.</p>
    {msg && <div className="notice">{msg}</div>}
    <div className="secondaryMarketGrid">
      {rows.map(r => <article className="panel" key={r.id}>
        <h3>{r.certificate_number}</h3>
        <p>Loan #{r.loan_number}</p>
        <p>Original investment <strong>${Number(r.original_principal).toFixed(2)}</strong></p>
        <p>Outstanding principal <strong>${Number(r.current_principal).toFixed(2)}</strong></p>
        <p>Seller asking price <strong>${Number(r.asking_price).toFixed(2)}</strong></p>
        <p>Discount to original <strong>{Number(r.discount_to_original_percent).toFixed(2)}%</strong></p>
        <button onClick={() => buy(r.id)} disabled={busy === r.id}>{busy === r.id ? 'Purchasing…' : `Buy for $${Number(r.asking_price).toFixed(2)}`}</button>
      </article>)}
      {!rows.length && <div className="panel">No open secondary-market listings.</div>}
    </div>
  </section>;
}
