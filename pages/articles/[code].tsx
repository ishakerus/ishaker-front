import type { GetServerSideProps } from "next";
import { NextSeo } from "next-seo";
import { ArticlePage } from "../../components/articles/ArticlePage";
import { requestStrapiRestAsService } from "../../services/server/strapiClient";
import { catalogGuides } from "../../lib/articles/catalogGuides";
import type { Article } from "../../types/article";

type ArticleRouteProps = {
  article: Article;
};

export default function ArticleRoute({ article }: ArticleRouteProps) {
  const title = article.seo_title || article.header || article.code;
  const description = article.seo_description || article.subheader || "iShaker support article";

  return (
    <>
      <NextSeo title={title} description={description} />
      <ArticlePage article={article} />
    </>
  );
}

export const getServerSideProps: GetServerSideProps<ArticleRouteProps> = async ({ params, res }) => {
  const rawCode = Array.isArray(params?.code) ? params?.code[0] : params?.code;
  const code = rawCode?.trim().toLowerCase();

  if (!code) return { notFound: true };
  const guide = catalogGuides.find((article) => article.code === code);
  if (guide) return { props: { article: guide } };

  const query = new URLSearchParams({
    "filters[code][$eq]": code,
    "filters[isOutdated][$eq]": "false",
    "pagination[pageSize]": "2000",
    "populate[machine_types][populate]": "preview",
  });

  try {
    const result = await requestStrapiRestAsService<Article[] | { data?: Article[] }>(`/api/articles?${query.toString()}`);
    const articles = Array.isArray(result) ? result : result?.data || [];
    const article = articles[0];

    if (!article || article.isOutdated === true) return { notFound: true };

    res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
    return { props: { article } };
  } catch (error) {
    console.error(`[articles/${code}] Failed to load article:`, error);
    return { notFound: true };
  }
};
