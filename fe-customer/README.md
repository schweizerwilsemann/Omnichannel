# Omnichannel Customer Web App

This package provides the customer-facing ordering experience for the Omnichannel platform.

## Getting Started

1. Copy `.env.example` to `.env` and adjust `REACT_APP_BASE_URL` to point at the backend API.
2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Run the development server:

   ```bash
   pnpm start
   ```

The application expects to be opened with a `qr` query parameter (for example `http://localhost:3001/?qr=table-abc`).


## Testing payments

- Use the Stripe test card `4242 4242 4242 4242` with any future expiry/CVC to simulate a successful online payment.
- Choose the *Pay at counter* option to mark the order as cash due; the backend records it with a pending payment status.
