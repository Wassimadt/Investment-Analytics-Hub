# FNI — Plateforme d'Investissement

## Overview

Application web complète pour le Fonds National d'Investissement Algérien (FNI). Plateforme de suivi, analyse, comparaison, valorisation et insights ML pour les projets d'investissement et les entreprises du portefeuille.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/fni-platform)
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Charts**: Recharts
- **Animation**: Framer Motion

## Features

- **Dashboard**: KPIs temps réel (valeur portefeuille, TRI moyen, projets actifs, risques), prévision ML 12 mois, répartition par secteur, flux d'activité
- **Projets**: Suivi complet avec statuts, niveaux de risque, TRI, progression, filtres et recherche
- **Entreprises**: Analyse financière (CA, EBITDA, dette, croissance), statuts, projets liés
- **Comparaison**: Outil side-by-side avec radar chart pour comparer 2-4 entreprises
- **Valorisation**: DCF, Comparables, Actif net, Marché, Valeur comptable
- **ML Insights**: Prédictions de succès, scores de risque, prévision de portefeuille

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Architecture

### Database tables
- `projects` — projets d'investissement
- `companies` — entreprises du portefeuille
- `valuations` — historique des valorisations
- `activity` — journal d'activité récente

### API Routes
- `GET /api/dashboard/summary` — KPIs globaux
- `GET /api/dashboard/activity` — flux d'activité
- `GET /api/dashboard/sector-breakdown` — répartition sectorielle
- `GET/POST /api/projects` — liste et création
- `GET/PUT/DELETE /api/projects/:id` — détail, mise à jour, suppression
- `GET /api/projects/stats` — statistiques agrégées
- `GET/POST /api/companies` — liste et création
- `GET/PUT /api/companies/:id` — détail et mise à jour
- `GET /api/companies/compare?ids=1,2,3` — comparaison
- `GET/POST /api/valuations` — valorisations
- `GET /api/ml/predictions` — prédictions ML
- `GET /api/ml/risk-scores` — scores de risque
- `GET /api/ml/portfolio-forecast` — prévision portefeuille

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
