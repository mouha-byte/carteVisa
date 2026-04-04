# Backend Permissions and RLS Matrix

This document tracks endpoint-level access requirements and the expected Supabase RLS coverage.

## Public Endpoints

| Endpoint | Method | Auth Required | App-Level Guard | Main Tables | RLS Expectation |
| --- | --- | --- | --- | --- | --- |
| /api/health | GET | No | None | categories | Public read allowed |
| /api/categories | GET | No | None | categories | Active categories readable by anon |
| /api/companies | GET | No | None | companies, company_categories, job_offers | Active company rows readable by anon |
| /api/companies/[slug] | GET | No | None | companies, job_offers, company_services, company_news, company_categories | Public company content readable when active/published |
| /api/jobs | GET | No | None | job_offers, companies | Published jobs readable by anon |
| /api/jobs/[id] | GET | No | None | job_offers, companies | Published jobs readable by anon |
| /api/applications | POST | No | Payload + file validation | job_offers, applications, storage:candidate-cv | Public insert allowed only for published jobs |
| /api/applications/[id]/receipt | GET | No | UUID validation | applications, job_offers, companies | Receipt reads depend on service-role backend access |
| /api/contact | POST | No | Payload + rate limit | contact_messages | Public insert allowed |
| /api/site-requests | POST | No | Payload + rate limit | website_creation_requests | Public insert allowed |
| /api/jobs (with category filter) | GET | No | Query filter validation | job_offers, company_categories, companies | Published jobs constrained to active/visible companies |

## Entreprise Endpoints

| Endpoint | Method | Auth Required | App-Level Guard | Main Tables | RLS Expectation |
| --- | --- | --- | --- | --- | --- |
| /api/company/profile | POST | Yes | authenticated + role=entreprise | companies, profiles | Entreprise can create own company and link profile |
| /api/company/profile | PATCH | Yes | authenticated + role=entreprise + company linked | companies | Entreprise can update own company |
| /api/company/jobs | GET | Yes | requireEntrepriseActor | job_offers | Entreprise can list own jobs |
| /api/company/jobs | POST | Yes | requireEntrepriseActor + payload validation | job_offers | Entreprise can create own jobs |
| /api/company/jobs/[id] | PATCH | Yes | requireEntrepriseActor + ownership check | job_offers | Entreprise can update own jobs |
| /api/company/jobs/[id] | DELETE | Yes | requireEntrepriseActor + ownership check | job_offers | Entreprise can delete own jobs |
| /api/company/applications | GET | Yes | requireEntrepriseActor + optional filters | applications, job_offers | Entreprise can list applications for own company |
| /api/company/applications/[id]/status | PATCH | Yes | requireEntrepriseActor + ownership + payload validation | applications | Entreprise can update status for own applications |
| /api/company/applications/[id]/cv | GET | Yes | requireEntrepriseActor + ownership + UUID validation | applications, storage:candidate-cv | Entreprise can download CV only for own company applications |

## Super Admin Endpoints

| Endpoint | Method | Auth Required | App-Level Guard | Main Tables | RLS Expectation |
| --- | --- | --- | --- | --- | --- |
| /api/admin/contact-messages | GET | Yes | requireSuperAdminActor | contact_messages | Super admin read access |
| /api/admin/site-requests | GET | Yes | requireSuperAdminActor | website_creation_requests | Super admin read access |
| /api/admin/companies | GET | Yes | requireSuperAdminActor + query validation | companies | Super admin read access |
| /api/admin/companies | POST | Yes | requireSuperAdminActor + payload validation | companies | Super admin create access |
| /api/admin/companies/[id] | PATCH | Yes | requireSuperAdminActor + UUID/payload validation | companies | Super admin update access (incl. activation/deactivation) |
| /api/admin/companies/[id] | DELETE | Yes | requireSuperAdminActor + UUID validation | companies | Super admin delete access |
| /api/admin/applications/[id]/cv | GET | Yes | requireSuperAdminActor + UUID validation | applications, storage:candidate-cv | Super admin can download CV for any application |

## Notes for Sprint 6

- Route-level guards are centralized with `requireAuthenticatedActor`, `requireEntrepriseActor`, and `requireSuperAdminActor`.
- JSON payload parsing is normalized with `parseJsonRequestBody` to consistently return `INVALID_JSON` on malformed bodies.
- Unhandled upstream errors are normalized through `apiErrorFromStatus` in shared API response handling.
