import { apiSuccess, handleApiError } from "@/lib/server/api-response";
import {
  cleanSearchTerm,
  parseLimitParam,
  parseSortParam,
} from "@/lib/server/query-utils";
import { supabaseGet } from "@/lib/server/supabase-rest";

type SearchType = "all" | "company" | "job" | "service" | "product";
type NormalizedSearchType = "all" | "company" | "job" | "service";

type CompanySearchRow = {
  id: string;
  name: string;
  slug: string;
  sector: string | null;
  description: string | null;
  city: string | null;
};

type JobSearchRow = {
  id: string;
  company_id: string;
  title: string;
  description: string;
  contract_type: string | null;
  location_city: string | null;
  is_remote: boolean;
};

type ServiceSearchRow = {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  price_label: string | null;
};

type CompanyCategoryRow = {
  company_id: string;
};

type CompanyIdRow = {
  id: string;
};

type CompanySummaryRow = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  sector: string | null;
};

type SearchResultItem = {
  id: string;
  type: "company" | "job" | "service";
  title: string;
  subtitle: string;
  description: string | null;
  city: string | null;
  link: string;
};

const SEARCH_TYPES = ["all", "company", "job", "service", "product"] as const;

export const runtime = "nodejs";

function normalizeSearchType(value: SearchType): NormalizedSearchType {
  return value === "product" ? "service" : value;
}

function intersectCompanyIds(
  existing: string[] | null,
  incoming: string[]
): string[] {
  const uniqueIncoming = [...new Set(incoming)];

  if (existing === null) {
    return uniqueIncoming;
  }

  const incomingSet = new Set(uniqueIncoming);
  return existing.filter((value) => incomingSet.has(value));
}

function trimDescription(value: string | null, max = 150): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length <= max) {
    return normalized;
  }

  return `${normalized.slice(0, max - 1)}…`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const q = cleanSearchTerm(searchParams.get("q"));
    const city = cleanSearchTerm(searchParams.get("city"));
    const categorySlug = cleanSearchTerm(searchParams.get("category"));

    const requestedType = parseSortParam<SearchType>(
      searchParams.get("type"),
      SEARCH_TYPES,
      "all"
    );
    const type = normalizeSearchType(requestedType);

    const limit = parseLimitParam(searchParams.get("limit"), 12, 30);

    if (!q && !city && !categorySlug) {
      return apiSuccess({
        items: [] as SearchResultItem[],
        totals: {
          companies: 0,
          jobs: 0,
          services: 0,
        },
      });
    }

    let filteredCompanyIds: string[] | null = null;

    if (categorySlug) {
      const categoryParams = new URLSearchParams({
        select: "company_id,categories!inner(slug)",
      });
      categoryParams.append("categories.slug", `eq.${categorySlug}`);

      const categoryResult = await supabaseGet<CompanyCategoryRow[]>(
        `company_categories?${categoryParams.toString()}`
      );

      filteredCompanyIds = intersectCompanyIds(
        filteredCompanyIds,
        categoryResult.data.map((item) => item.company_id)
      );

      if (filteredCompanyIds.length === 0) {
        return apiSuccess({
          items: [] as SearchResultItem[],
          totals: {
            companies: 0,
            jobs: 0,
            services: 0,
          },
        });
      }
    }

    if (city) {
      const cityParams = new URLSearchParams({
        select: "id",
        status: "eq.active",
        limit: "500",
      });
      cityParams.append("city", `ilike.*${city}*`);

      const cityCompaniesResult = await supabaseGet<CompanyIdRow[]>(
        `companies?${cityParams.toString()}`
      );

      filteredCompanyIds = intersectCompanyIds(
        filteredCompanyIds,
        cityCompaniesResult.data.map((item) => item.id)
      );

      if (filteredCompanyIds.length === 0) {
        return apiSuccess({
          items: [] as SearchResultItem[],
          totals: {
            companies: 0,
            jobs: 0,
            services: 0,
          },
        });
      }
    }

    const companyFilterIds = filteredCompanyIds ? filteredCompanyIds.slice(0, 250) : null;

    const shouldQueryCompanies = type === "all" || type === "company";
    const shouldQueryJobs = type === "all" || type === "job";
    const shouldQueryServices = type === "all" || type === "service";

    let companies: CompanySearchRow[] = [];
    let jobs: JobSearchRow[] = [];
    let services: ServiceSearchRow[] = [];

    if (shouldQueryCompanies) {
      const companyParams = new URLSearchParams({
        select: "id,name,slug,sector,description,city",
        status: "eq.active",
        order: "created_at.desc",
        limit: String(limit),
      });

      if (q) {
        companyParams.append(
          "or",
          `(name.ilike.*${q}*,sector.ilike.*${q}*,description.ilike.*${q}*)`
        );
      }

      if (city) {
        companyParams.append("city", `ilike.*${city}*`);
      }

      if (companyFilterIds && companyFilterIds.length > 0) {
        companyParams.append("id", `in.(${companyFilterIds.join(",")})`);
      }

      const companiesResult = await supabaseGet<CompanySearchRow[]>(
        `companies?${companyParams.toString()}`
      );

      companies = companiesResult.data;
    }

    if (shouldQueryJobs) {
      const jobsParams = new URLSearchParams({
        select:
          "id,company_id,title,description,contract_type,location_city,is_remote",
        status: "eq.published",
        order: "published_at.desc",
        limit: String(limit),
      });

      if (q) {
        jobsParams.append(
          "or",
          `(title.ilike.*${q}*,description.ilike.*${q}*)`
        );
      }

      if (city) {
        jobsParams.append("location_city", `ilike.*${city}*`);
      }

      if (companyFilterIds && companyFilterIds.length > 0) {
        jobsParams.append("company_id", `in.(${companyFilterIds.join(",")})`);
      }

      const jobsResult = await supabaseGet<JobSearchRow[]>(
        `job_offers?${jobsParams.toString()}`
      );

      jobs = jobsResult.data;
    }

    if (shouldQueryServices) {
      const servicesParams = new URLSearchParams({
        select: "id,company_id,title,description,price_label",
        is_active: "eq.true",
        order: "created_at.desc",
        limit: String(limit),
      });

      if (q) {
        servicesParams.append(
          "or",
          `(title.ilike.*${q}*,description.ilike.*${q}*,price_label.ilike.*${q}*)`
        );
      }

      if (companyFilterIds && companyFilterIds.length > 0) {
        servicesParams.append("company_id", `in.(${companyFilterIds.join(",")})`);
      }

      const servicesResult = await supabaseGet<ServiceSearchRow[]>(
        `company_services?${servicesParams.toString()}`
      );

      services = servicesResult.data;
    }

    const relatedCompanyIds = [
      ...new Set([
        ...companies.map((item) => item.id),
        ...jobs.map((item) => item.company_id),
        ...services.map((item) => item.company_id),
      ]),
    ];

    const companiesById = new Map<string, CompanySummaryRow>();

    if (relatedCompanyIds.length > 0) {
      const summaryParams = new URLSearchParams({
        select: "id,name,slug,city,sector",
      });
      summaryParams.append("status", "eq.active");
      summaryParams.append("id", `in.(${relatedCompanyIds.join(",")})`);

      const companySummaryResult = await supabaseGet<CompanySummaryRow[]>(
        `companies?${summaryParams.toString()}`
      );

      for (const company of companySummaryResult.data) {
        companiesById.set(company.id, company);
      }
    }

    const companyItems: SearchResultItem[] = companies.map((company) => ({
      id: company.id,
      type: "company",
      title: company.name,
      subtitle: `${company.sector || "Secteur"} • ${company.city || "Ville"}`,
      description: trimDescription(company.description),
      city: company.city,
      link: `/entreprises/${company.slug}`,
    }));

    const jobItems: SearchResultItem[] = [];
    for (const job of jobs) {
      const company = companiesById.get(job.company_id);
      if (!company) {
        continue;
      }

      const subtitle = [
        company.name,
        job.location_city || company.city || "Ville",
        job.contract_type || "Contrat",
        job.is_remote ? "Remote" : null,
      ]
        .filter((value) => Boolean(value))
        .join(" • ");

      const queryParams = new URLSearchParams({
        job: job.id,
        company: company.slug,
      });

      jobItems.push({
        id: job.id,
        type: "job",
        title: job.title,
        subtitle,
        description: trimDescription(job.description),
        city: job.location_city || company.city,
        link: `/contact?${queryParams.toString()}`,
      });
    }

    const serviceItems: SearchResultItem[] = [];
    for (const service of services) {
      const company = companiesById.get(service.company_id);
      if (!company) {
        continue;
      }

      const subtitle = [company.name, service.price_label || "Sur devis"]
        .filter((value) => Boolean(value))
        .join(" • ");

      const queryParams = new URLSearchParams({
        service: service.id,
        company: company.slug,
      });

      serviceItems.push({
        id: service.id,
        type: "service",
        title: service.title,
        subtitle,
        description: trimDescription(service.description),
        city: company.city,
        link: `/contact?${queryParams.toString()}`,
      });
    }

    const items = [...companyItems, ...jobItems, ...serviceItems].slice(0, limit * 3);

    return apiSuccess({
      items,
      totals: {
        companies: companyItems.length,
        jobs: jobItems.length,
        services: serviceItems.length,
      },
      filters: {
        q,
        type,
        city,
        category: categorySlug,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
