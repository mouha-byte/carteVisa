import { apiSuccess, handleApiError } from "@/lib/server/api-response";
import {
  cleanSearchTerm,
  parseLimitParam,
  parsePageParam,
  parseSortParam,
} from "@/lib/server/query-utils";
import { supabaseGet } from "@/lib/server/supabase-rest";

type JobRow = {
  id: string;
  company_id: string;
  title: string;
  description: string;
  contract_type: string | null;
  location_city: string | null;
  salary_min: number | null;
  salary_max: number | null;
  is_remote: boolean;
  status: string;
  published_at: string | null;
  created_at: string;
};

type CompanySummaryRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  cover_url: string | null;
  city: string | null;
  sector: string | null;
};

type CompanyCategoryRow = {
  company_id: string;
};

const ALLOWED_SORTS = [
  "newest",
  "oldest",
  "title_asc",
  "title_desc",
] as const;

const SORT_TO_DB_ORDER: Record<(typeof ALLOWED_SORTS)[number], string> = {
  newest: "published_at.desc",
  oldest: "published_at.asc",
  title_asc: "title.asc",
  title_desc: "title.desc",
};

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parsePageParam(searchParams.get("page"), 1);
    const limit = parseLimitParam(searchParams.get("limit"), 12, 50);
    const sort = parseSortParam(searchParams.get("sort"), ALLOWED_SORTS, "newest");

    const search = cleanSearchTerm(searchParams.get("q"));
    const city = cleanSearchTerm(searchParams.get("city"));
    const companySlug = cleanSearchTerm(searchParams.get("company"));
    const categorySlug = cleanSearchTerm(searchParams.get("category"));

    const offset = (page - 1) * limit;

    let companyIdsFilter: string[] | null = null;

    if (companySlug) {
      const companyParams = new URLSearchParams({
        select: "id",
        slug: `eq.${companySlug}`,
        status: "eq.active",
        limit: "1",
      });

      const companyResult = await supabaseGet<{ id: string }[]>(
        `companies?${companyParams.toString()}`
      );

      const company = companyResult.data[0];
      if (!company) {
        return apiSuccess([], {
          page,
          limit,
          total: 0,
          totalPages: 0,
        });
      }

      companyIdsFilter = [company.id];
    }

    if (categorySlug) {
      const categoryParams = new URLSearchParams({
        select: "company_id,categories!inner(slug)",
      });
      categoryParams.append("categories.slug", `eq.${categorySlug}`);

      const categoryResult = await supabaseGet<CompanyCategoryRow[]>(
        `company_categories?${categoryParams.toString()}`
      );

      const categoryCompanyIds = [
        ...new Set(categoryResult.data.map((item) => item.company_id)),
      ];

      if (categoryCompanyIds.length === 0) {
        return apiSuccess([], {
          page,
          limit,
          total: 0,
          totalPages: 0,
        });
      }

      if (companyIdsFilter) {
        const categoryIdSet = new Set(categoryCompanyIds);
        companyIdsFilter = companyIdsFilter.filter((id) => categoryIdSet.has(id));
      } else {
        companyIdsFilter = categoryCompanyIds;
      }

      if (companyIdsFilter.length === 0) {
        return apiSuccess([], {
          page,
          limit,
          total: 0,
          totalPages: 0,
        });
      }
    }

    const jobsParams = new URLSearchParams({
      select:
        "id,company_id,title,description,contract_type,location_city,salary_min,salary_max,is_remote,status,published_at,created_at",
      status: "eq.published",
      order: SORT_TO_DB_ORDER[sort],
      limit: String(limit),
      offset: String(offset),
    });

    if (search) {
      jobsParams.append(
        "or",
        `(title.ilike.*${search}*,description.ilike.*${search}*)`
      );
    }

    if (city) {
      jobsParams.append("location_city", `ilike.*${city}*`);
    }

    if (companyIdsFilter) {
      jobsParams.append("company_id", `in.(${companyIdsFilter.join(",")})`);
    }

    const jobsResult = await supabaseGet<JobRow[]>(
      `job_offers?${jobsParams.toString()}`,
      {
        count: true,
      }
    );

    const jobs = jobsResult.data;
    const total = jobsResult.count ?? jobs.length;
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    const companyIds = [...new Set(jobs.map((job) => job.company_id))];
    const companiesById = new Map<string, CompanySummaryRow>();

    if (companyIds.length > 0) {
      const companySummaryParams = new URLSearchParams({
        select: "id,name,slug,logo_url,cover_url,city,sector",
      });
      companySummaryParams.append("id", `in.(${companyIds.join(",")})`);

      const companiesResult = await supabaseGet<CompanySummaryRow[]>(
        `companies?${companySummaryParams.toString()}`
      );

      for (const company of companiesResult.data) {
        companiesById.set(company.id, company);
      }
    }

    const data = jobs.map((job) => ({
      ...job,
      company: companiesById.get(job.company_id) ?? null,
    }));

    return apiSuccess(data, {
      page,
      limit,
      total,
      totalPages,
      sort,
      company: companySlug,
      category: categorySlug,
      q: search,
      city,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
