// Add to App.tsx

import Portfolio from "./pages/Portfolio";
import AdminInvestmentRefunds from "./components/AdminInvestmentRefunds";

<Route path="/portfolio" element={<Portfolio />} />
<Route path="/investor/portfolio" element={<Portfolio />} />
<Route path="/admin/investment-refunds" element={<AdminInvestmentRefunds />} />
