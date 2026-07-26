# v3.2.3

- Creates the exact borrower-signature RPC expected by the deployed Closing Center.
- Uses bigint loan and generated-document IDs.
- Avoids one all-or-nothing transaction so optional policy errors cannot erase a successfully created RPC.
- Repairs missing request-table columns and indexes.
- Grants RPC execution to authenticated users and service role.
- Reloads the PostgREST schema cache.
- Includes a guarded reset for incompatible partial UUID tables.
- Includes verification queries.
