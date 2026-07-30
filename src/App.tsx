// src/App.tsx
// Add these lines to your existing App.tsx

import BorrowerOffer from "./pages/BorrowerOffer";

// Inside your <Routes>:
<Route
  path="/borrower-offer/:counterofferId"
  element={<BorrowerOffer />}
/>
