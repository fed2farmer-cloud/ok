type PromissoryNoteTerms = Record<string, unknown>;

function money(value: unknown) {
  return Number(value || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function text(value: unknown, fallback = "Not provided") {
  const result = String(value ?? "").trim();
  return result || fallback;
}

export default function PromissoryNoteDocument({ terms }: { terms: PromissoryNoteTerms }) {
  const principal = money(terms.approved_loan_amount);
  const rate = Number(terms.borrower_interest_rate || 0);
  const term = Number(terms.repayment_term_months || 0);
  const payment = money(terms.monthly_payment);
  const state = text(terms.state, "the applicable state");

  return (
    <div className="space-y-5 text-sm leading-7 text-slate-700">
      <div className="text-center">
        <h2 className="text-xl font-black uppercase tracking-wide text-slate-950">
          Secured Promissory Note
        </h2>
        <p className="mt-1 font-semibold">Loan #{text(terms.loan_number)}</p>
        <p className="text-xs text-slate-500">Draft for borrower review — not effective until executed</p>
      </div>

      <p>
        <strong>FOR VALUE RECEIVED</strong>, {text(terms.borrower_name)}
        {terms.business_name ? `, on behalf of ${text(terms.business_name)},` : ""} (the
        “Borrower”) promises to pay to the order of Secured Landing’s designated lender or
        lawful holder (the “Lender”) the principal sum of <strong>{principal}</strong>, plus
        interest and other amounts due under this Note.
      </p>

      <section>
        <h3 className="font-black text-slate-950">1. Interest and repayment</h3>
        <p>
          Interest accrues on the unpaid principal balance at a fixed annual rate of
          <strong> {rate}%</strong>. The scheduled term is <strong>{term} months</strong>, with an
          estimated monthly payment of <strong>{payment}</strong>. The final payment schedule,
          first payment date, maturity date, and any escrow items will be stated in the executed
          closing package.
        </p>
      </section>

      <section>
        <h3 className="font-black text-slate-950">2. Payment method and application</h3>
        <p>
          Payments must be made in lawful United States currency through a payment method
          authorized by the Lender. Unless applicable law requires otherwise, payments may be
          applied first to permitted costs and fees, then accrued interest, and then principal.
        </p>
      </section>

      <section>
        <h3 className="font-black text-slate-950">3. Prepayment</h3>
        <p>
          Borrower may prepay principal in whole or in part subject to the final loan agreement,
          any disclosed prepayment provision, and applicable law. Partial prepayments do not
          postpone scheduled installments unless the Lender agrees in writing.
        </p>
      </section>

      <section>
        <h3 className="font-black text-slate-950">4. Late payment and default</h3>
        <p>
          A failure to make a payment when due, a material false statement, an unauthorized
          transfer of collateral, failure to maintain required insurance or taxes, or breach of
          another closing document may constitute a default after any notice and cure period
          required by law. Following default, the holder may accelerate the unpaid balance and
          exercise lawful remedies.
        </p>
      </section>

      <section>
        <h3 className="font-black text-slate-950">5. Security</h3>
        <p>
          This Note is intended to be secured by a mortgage, deed of trust, or other security
          instrument covering the property at <strong>{text(terms.property_address)}</strong>, APN
          <strong> {text(terms.apn)}</strong>, in {text(terms.county)} County, {state}. The separate
          security instrument controls the collateral and foreclosure remedies.
        </p>
      </section>

      <section>
        <h3 className="font-black text-slate-950">6. Costs, notices, and governing law</h3>
        <p>
          To the extent permitted by law, Borrower may be responsible for reasonable enforcement
          costs described in the executed documents. Notices must be delivered as provided in the
          closing agreement. This Note will be governed by applicable federal law and the law of
          {state}, without waiving any mandatory borrower protections.
        </p>
      </section>

      <section>
        <h3 className="font-black text-slate-950">7. Assignment and electronic signatures</h3>
        <p>
          The Lender may assign or transfer this Note as permitted by law and the final agreement.
          Electronic records and signatures may be used when the parties have consented and the
          method complies with applicable law.
        </p>
      </section>

      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
        <strong>Legal review required:</strong> This is a platform-generated draft summary. It is
        not a substitute for a state-compliant promissory note prepared or approved by qualified
        lending counsel. The executed note must include final dates, payment address, lender and
        holder information, required notices, signatures, and all state-specific disclosures.
      </div>

      <div className="grid gap-8 pt-6 sm:grid-cols-2">
        <div className="border-t border-slate-400 pt-2">
          <p className="font-bold">Borrower signature</p>
          <p className="text-xs text-slate-500">{text(terms.borrower_name)}</p>
        </div>
        <div className="border-t border-slate-400 pt-2">
          <p className="font-bold">Date</p>
        </div>
      </div>
    </div>
  );
}
