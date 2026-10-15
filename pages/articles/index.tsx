import type { GetServerSideProps } from "next";
import { NextSeo } from "next-seo";
import { ArticlesIndexPage } from "../../components/articles/ArticlesIndexPage";
import { requestStrapiRestAsService } from "../../services/server/strapiClient";
import { catalogGuides } from "../../lib/articles/catalogGuides";
import type { Article } from "../../types/article";

type ArticlesRouteProps = {
  articles: Article[];
};

const PAGE_SIZE = 2000;

export default function ArticlesRoute({ articles }: ArticlesRouteProps) {
  return (
    <>
      <NextSeo
        title="Articles"
        description="iShaker setup instructions, troubleshooting guides, and practical support articles."
      />
      <ArticlesIndexPage articles={articles} />
    </>
  );
}

const loadArticlePage = async (page: number) => {
  const query = new URLSearchParams({
    "filters[isOutdated][$eq]": "false",
    "sort[0]": "createdAt:desc",
    "pagination[page]": String(page),
    "pagination[pageSize]": String(PAGE_SIZE),
    "fields[0]": "code",
    "fields[1]": "header",
    "fields[2]": "subheader",
    "fields[3]": "seo_title",
    "fields[4]": "seo_description",
    "fields[5]": "type",
    "fields[6]": "isOutdated",
    "populate[machine_types][populate]": "preview",
  });

  const result = await requestStrapiRestAsService<
    Article[] | { data?: Article[] }
  >(`/api/articles?${query.toString()}`);

  return Array.isArray(result) ? result : result?.data || [];
};

export const getServerSideProps: GetServerSideProps<ArticlesRouteProps> = async ({ res }) => {
  try {
    const articles: Article[] = [];

    for (let page = 1; page <= 100; page += 1) {
      const batch = await loadArticlePage(page);
      articles.push(...batch.filter((article) => article.isOutdated !== true));
      if (batch.length < PAGE_SIZE) break;
    }

    res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
    return { props: { articles: [...catalogGuides, ...articles.filter((article) => !catalogGuides.some((guide) => guide.code === article.code))] } };
  } catch (error) {
    console.error("[articles] Failed to load articles:", error);
    return { props: { articles: catalogGuides } };
  }
};
