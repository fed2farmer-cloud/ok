# Six-Digit Public Loan Numbers

Run `20260713_random_public_loan_numbers.sql` in the Supabase SQL Editor before deploying this version.

What it does:
- Adds `loan_applications.loan_number`.
- Assigns every existing loan a unique random six-digit number from 112782 through 999999.
- Automatically assigns a number to every new loan.
- Copies the public number into marketplace listings.
- Keeps the existing `id` unchanged as the internal database relationship key.

The borrower dashboard, admin dashboard, and investor marketplace now show the public loan number instead of IDs such as `9`.
