# SecuredLanding v4.5.6 — Open Closing Center Button

## Purpose
Adds a visible borrower-dashboard action for approved/funded loans so borrowers can open the Closing Center without manually typing the URL.

## Behavior
- Shows **Open Closing Center →** on loan cards whose displayed status is Approved, Funded, Active, Completed, or Closed.
- Does not show the button for Pending or Denied loans.
- Uses the internal loan application ID in the route:
  `/closing-center?loanId=<application_id>`
- Button is full-width on mobile and collapses to auto width on larger screens.

## Loan 460109 test route
Loan #460109 currently maps to internal loan application ID 1, so the button routes to:
`/closing-center?loanId=1`

## Database / API changes
None. No Supabase migration is required. No serverless function was added.
