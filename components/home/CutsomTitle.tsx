import {
  useToken,
  Text,
  useColorModeValue,
  Box,
  BoxProps,
  TextProps,
} from "@chakra-ui/react";
import React from "react";

type CustomTitleProps = {
  as: "h1" | "h2" | "h3";
  title: string;
  subtitle?: string;
  subtitle2?: string;
  subtitleProps?: TextProps;
  subtitle2Props?: TextProps;
} & BoxProps;

export default function CustomTitle({
  as,
  title,
  subtitle,
  subtitle2,
  subtitleProps,
  subtitle2Props,
  ...props
}: CustomTitleProps) {
  const [peripheryColor, centerColor] = useToken(
    "colors",
    useColorModeValue(["bg.500", "violet.700"], ["bg.200", "acid.300"]),
  );

  return (
    <Box
      mt={{ base: "16", lg: "32" }}
      mb={{ base: "8", lg: "16" }}
      zIndex="1"
      bgGradient={`radial-gradient(circle at 50% -10%, ${centerColor} 10%, ${peripheryColor} 70%)`}
      bgClip="text"
      fontSize={{ base: "2xl", lg: "6xl" }}
      w="100%"
      textAlign={"center"}
      {...props}
    >
      <Text
        as={as}
        fontWeight="bold"
        color="inherit"
        fontSize="inherit"
        lineHeight="1"
        letterSpacing="0"
      >
        {title}
      </Text>
      {subtitle && (
        <Text
          mx="2"
          as="p"
          fontSize={{ base: "sm", lg: "2xl" }}
          mt={{ base: "2", lg: "4" }}
          color="bg.400"
          fontWeight="light"
          {...subtitleProps}
        >
          {subtitle}
        </Text>
      )}

      {subtitle2 && (
        <Text
          mx="2"
          as="p"
          fontSize={{ base: "sm", lg: "xl" }}
          mt={2}
          color="bg.400"
          fontWeight="light"
          fontFamily="Montserrat, sans-serif"
          {...subtitle2Props}
        >
          {subtitle2}
        </Text>
      )}
    </Box>
  );
}
