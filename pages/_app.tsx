import "../styles/globals.css";
import { SupportSessionBanner } from "../components/admin/SupportSessionBanner";
import type { AppProps } from "next/app";
import { ChakraProvider } from "@chakra-ui/react";
import { DefaultSeo } from "next-seo";
import Head from "next/head";
import { Provider } from "react-redux";
import { useEffect } from "react";
import theme from "../styles/theme";
import store from "../redux/store";
import { Footer } from "../components/Footer";
import RouteLoadingOverlay from "../components/shared/RouteLoadingOverlay";

function MyApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    import("@lottiefiles/dotlottie-react")
      .then(({ setWasmUrl }) => {
        setWasmUrl("/dotlottie-player.wasm");
      })
      .catch((error) => {
        // Animations are decorative. A stale optional chunk should never take
        // down the whole application while Next rebuilds in development.
        console.warn("[iShaker] Lottie initialization skipped:", error);
      });
  }, []);

  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
        />
      </Head>
      <Provider store={store}>
        <ChakraProvider theme={theme}>
          <DefaultSeo
            titleTemplate="%s | iShaker"
            defaultTitle="iShaker"
            description="A polished digital home for iShaker."
            openGraph={{
              type: "website",
              locale: "en_US",
              siteName: "iShaker",
            }}
          />
          <RouteLoadingOverlay />
          <SupportSessionBanner session={pageProps.session} />
          <Component {...pageProps} />
          <Footer />
        </ChakraProvider>
      </Provider>
    </>
  );
}

export default MyApp;
