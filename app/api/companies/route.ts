import { apiSuccess, handleApiError } from "@/lib/server/api-response";
import {
  cleanSearchTerm,
  parseLimitParam,
  parsePageParam,
  parseSortParam,
} from "@/lib/server/query-utils";
import { supabaseGet } from "@/lib/server/supabase-rest";

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  company_type: "sarl" | "startup";
  sector: string | null;
  description: string | null;
  city: string | null;
  country: string | null;
  logo_url: string | null;
  cover_url: string | null;
  website_url: string | null;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
};

type CompanyCategoryRow = {
  company_id: string;
};

type JobCompanyRow = {
  company_id: string;
};

const ALLOWED_SORTS = [
  "newest",
  "oldest",
  "name_asc",
  "name_desc",
] as const;

const SORT_TO_DB_ORDER: Record<(typeof ALLOWED_SORTS)[number], string> = {
  newest: "created_at.desc",
  oldest: "created_at.asc",
  name_asc: "name.asc",
  name_desc: "name.desc",
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
    const categorySlug = cleanSearchTerm(searchParams.get("category"));

    const offset = (page - 1) * limit;

    let companyIdsFromCategory: string[] | null = null;
    if (categorySlug) {
      const categoryParams = new URLSearchParams({
        select: "company_id,categories!inner(slug)",
      });
      categoryParams.append("categories.slug", `eq.${categorySlug}`);

      const categoryResult = await supabaseGet<CompanyCategoryRow[]>(
        `company_categories?${categoryParams.toString()}`
      );

      companyIdsFromCategory = [
        ...new Set(categoryResult.data.map((item) => item.company_id)),
      ];

      if (companyIdsFromCategory.length === 0) {
        return apiSuccess([], {
          page,
          limit,
          total: 0,
          totalPages: 0,
        });
      }
    }

    const params = new URLSearchParams({
      select:
        "id,name,slug,company_type,sector,description,city,country,logo_url,cover_url,website_url,is_featured,created_at,updated_at",
      order: SORT_TO_DB_ORDER[sort],
      limit: String(limit),
      offset: String(offset),
    });

    params.append("status", "eq.active");

    if (search) {
      params.append(
        "or",
        `(name.ilike.*${search}*,sector.ilike.*${search}*,city.ilike.*${search}*)`
      );
    }

    if (city) {
      params.append("city", `ilike.*${city}*`);
    }

    if (companyIdsFromCategory && companyIdsFromCategory.length > 0) {
      params.append("id", `in.(${companyIdsFromCategory.join(",")})`);
    }

    const companiesResult = await supabaseGet<CompanyRow[]>(
      `companies?${params.toString()}`,
      {
        count: true,
      }
    );

    const companies = companiesResult.data;
    const total = companiesResult.count ?? companies.length;
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    const companyIds = companies.map((company) => company.id);
    const openJobsCountByCompanyId = new Map<string, number>();

    if (companyIds.length > 0) {
      const jobsParams = new URLSearchParams({
        select: "company_id",
      });
      jobsParams.append("status", "eq.published");
      jobsParams.append("company_id", `in.(${companyIds.join(",")})`);

      const jobsResult = await supabaseGet<JobCompanyRow[]>(
        `job_offers?${jobsParams.toString()}`
      );

      for (const item of jobsResult.data) {
        const current = openJobsCountByCompanyId.get(item.company_id) ?? 0;
        openJobsCountByCompanyId.set(item.company_id, current + 1);
      }
    }

    const data = companies.map((company) => ({
      ...company,
      open_jobs_count: openJobsCountByCompanyId.get(company.id) ?? 0,
    }));

    return apiSuccess(data, {
      page,
      limit,
      total,
      totalPages,
      sort,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
