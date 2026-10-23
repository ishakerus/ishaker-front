import { Box, BoxProps, Spinner } from "@chakra-ui/react";
import dynamic from "next/dynamic";

function LoaderFallback() {
  return (
    <Box w="full" h="full" display="flex" alignItems="center" justifyContent="center">
      <Spinner w="33.333%" h="33.333%" color="acid.300" thickness="2px" />
    </Box>
  );
}

const DotLottieReact = dynamic(
  () =>
    import("@lottiefiles/dotlottie-react")
      .then((mod) => {
        mod.setWasmUrl("/dotlottie-player.wasm");
        return mod.DotLottieReact;
      })
      .catch(() => LoaderFallback),
  { ssr: false, loading: LoaderFallback },
);

const sizeMap = {
  xs: 16,
  sm: 24,
  md: 32,
  lg: 48,
  xl: 72,
};

const LOTTIE_SCALE = 3;

type LoaderProps = Omit<BoxProps, "size"> & {
  size?: keyof typeof sizeMap | number;
};

export default function Loader({
  size = "md",
  ...boxProps
}: LoaderProps) {
  const pixels =
    (typeof size === "number" ? size : sizeMap[size]) * LOTTIE_SCALE;
  const boxSize = `${pixels}px`;

  return (
    <Box
      role="status"
      aria-label="Loading"
      boxSize={boxSize}
      flexShrink={0}
      {...boxProps}
    >
      <DotLottieReact
        src="/cup.lottie"
        autoplay
        loop
        style={{ width: boxSize, height: boxSize }}
      />
    </Box>
  );
}
