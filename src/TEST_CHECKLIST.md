# SecuredLanding v2.9 State Document QA

Run one sample approval for every supported state:

| State | Expected security-document title |
|---|---|
| CA | California Deed of Trust — Attorney Review Required |
| TX | Texas Deed of Trust — Attorney Review Required |
| AZ | Arizona Deed of Trust — Attorney Review Required |
| NV | Nevada Deed of Trust — Attorney Review Required |
| WA | Washington Deed of Trust — Attorney Review Required |
| OR | Oregon Trust Deed — Attorney Review Required |
| CO | Colorado Deed of Trust — Attorney Review Required |
| UT | Utah Trust Deed — Attorney Review Required |
| VA | Virginia Deed of Trust — Attorney Review Required |
| NC | North Carolina Deed of Trust — Attorney Review Required |
| AR | Arkansas Real Estate Mortgage — Attorney Review Required |
| MO | Missouri Deed of Trust — Attorney Review Required |

## Required tests

- The full state name and two-letter abbreviation both normalize correctly.
- A Missouri property never receives a document containing “California.”
- A blank state stops generation with an error.
- An unsupported state stops generation with an error.
- Changing a property state requires admin regeneration.
- The database blocks a document whose `document_state` differs from the
  loan application's collateral-property state.
- Existing borrower documents remain accessible.
- Approval, Closing Center creation, marketplace publishing, video review,
  and investor wallet workflows still operate.
- No borrower can sign while a mismatch warning is displayed.
