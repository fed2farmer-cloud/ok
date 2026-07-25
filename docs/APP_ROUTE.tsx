// Add this import to src/App.tsx:
import BorrowerDocumentSignature from "./pages/BorrowerDocumentSignature";

// Add this route inside your Routes component:
<Route
  path="/sign-document/:requestId"
  element={<BorrowerDocumentSignature />}
/>
