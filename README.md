
# Invoice & Receipt Generator — DevSecOps

A web application for creating invoices, calculating totals and taxes, processing simulated payments, and generating receipts.

## Before you start: Node.js version requiremnet
To run the boilerplate in main branch without errors, you need Node.js 22.x  (minimum 22.16; tested on 22.23.4) 

It's due to SQLite npm package thing.

The backend uses Node.js’s built-in SQLite module (node:sqlite). This avoids installing a separate SQLite package that may require native compilation.

To install and switch to Node.js 22:

```
nvm install 22
nvm use 22
node -v
```

You may see an ExperimentalWarning for SQLite. This is expected on Node.js 22 and does not mean the application failed.

## To Frontend developer: 
### what you can start now
Create frontend scaffold; build invoice form, list and detail screens using sample JSON; add loading/error states

### Integrate later
Connect to real endpoints when feature/backend (invoice API) is merged.

## To DevSecOps: 
### what you can start now
Configure GitHub Actions for backend installation, SQLite initialization, syntax checks and tests; set up SonarQube and CodeQL

Here, “configure GitHub Actions” means making those steps run automatically whenever someone pushes code or opens a PR.

### Integrate later
Add frontend build checks after feature/frontend is merged; expand tests as features arrive


## Project Overview

This project demonstrates how DevSecOps practices can improve software security, reliability, and code quality throughout the development lifecycle.

## Planned Features

- Create invoices with line items, quantities, and prices
- Calculate taxes and invoice totals
- Generate payment links using Stripe test mode
- Verify Stripe payment events
- Generate PDF receipts for paid invoices

## Planned Technologies

- Frontend: To be determined
- Backend: Node.js and Express
- Database: SQLite
- Payments: Stripe test mode
- CI/CD: GitHub Actions
- Static Code Analysis: SonarQube / CodeQL
- Automated Testing: Vitest or Jest

## Team Responsibilities

- Member 1: Backend, database, and Stripe integration
- Member 2: Frontend and user interface
- Member 3: DevSecOps, CI/CD, and automated testing

## Development Workflow

All development takes place in feature branches. Changes are merged into `main` through pull requests.

## Project Status

Initial repository setup.
    