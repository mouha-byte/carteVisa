import { apiError, apiSuccess, handleApiError } from "@/lib/server/api-response";
import { supabaseGet } from "@/lib/server/supabase-rest";

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  sector: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  logo_url: string | null;
  cover_url: string | null;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
};

type JobRow = {
  id: string;
  title: string;
  contract_type: string | null;
  location_city: string | null;
  is_remote: boolean;
  status: string;
  published_at: string | null;
  created_at: string;
};

type ServiceRow = {
  id: string;
  title: string;
  description: string | null;
  price_label: string | null;
  is_active: boolean;
};

type NewsRow = {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  is_published: boolean;
  published_at: string;
  created_at: string;
};

type CompanyCategoryJoinRow = {
  categories: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;

    const companyParams = new URLSearchParams({
      select:
        "id,name,slug,sector,description,address,city,country,phone,email,website_url,logo_url,cover_url,is_featured,created_at,updated_at",
      slug: `eq.${slug}`,
      status: "eq.active",
      limit: "1",
    });

    const companyResult = await supabaseGet<CompanyRow[]>(
      `companies?${companyParams.toString()}`
    );

    const company = companyResult.data[0];
    if (!company) {
      return apiError(404, "NOT_FOUND", "Company not found.");
    }

    const jobsParams = new URLSearchParams({
      select:
        "id,title,contract_type,location_city,is_remote,status,published_at,created_at",
      company_id: `eq.${company.id}`,
      status: "eq.published",
      order: "published_at.desc",
    });

    const servicesParams = new URLSearchParams({
      select: "id,title,description,price_label,is_active",
      company_id: `eq.${company.id}`,
      is_active: "eq.true",
      order: "created_at.desc",
    });

    const newsParams = new URLSearchParams({
      select: "id,title,content,image_url,is_published,published_at,created_at",
      company_id: `eq.${company.id}`,
      is_published: "eq.true",
      order: "published_at.desc",
      limit: "10",
    });

    const categoriesParams = new URLSearchParams({
      select: "categories!inner(id,name,slug)",
      company_id: `eq.${company.id}`,
    });

    const [jobsResult, servicesResult, newsResult, categoriesResult] =
      await Promise.all([
        supabaseGet<JobRow[]>(`job_offers?${jobsParams.toString()}`),
        supabaseGet<ServiceRow[]>(`company_services?${servicesParams.toString()}`),
        supabaseGet<NewsRow[]>(`company_news?${newsParams.toString()}`),
        supabaseGet<CompanyCategoryJoinRow[]>(
          `company_categories?${categoriesParams.toString()}`
        ),
      ]);

    return apiSuccess({
      ...company,
      jobs: jobsResult.data,
      services: servicesResult.data,
      news: newsResult.data,
      categories: categoriesResult.data
        .map((item) => item.categories)
        .filter((category) => Boolean(category)),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
