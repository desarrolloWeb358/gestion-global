// Typography.tsx (polimórfico, con tipos por tag)
import React from "react";
import clsx from "clsx";
import { JSX } from "react/jsx-runtime";

type Variant = "h1" | "h2" | "h3" | "lead" | "body" | "small" | "muted";
type Font = "primary" | "secondary";
type ElementType = keyof JSX.IntrinsicElements;

// EXCLUYE tags SVG del "as"
type SvgTags =
  | "svg" | "circle" | "clipPath" | "defs" | "ellipse" | "foreignObject" | "g"
  | "image" | "line" | "linearGradient" | "marker" | "mask" | "path" | "pattern"
  | "polygon" | "polyline" | "radialGradient" | "rect" | "stop" | "symbol" | "text"
  | "textPath" | "tspan" | "use" | "view";
type HtmlOnly = Exclude<ElementType, SvgTags>;

const styles: Record<Variant, string> = {
  h1: "text-4xl leading-tight font-bold",
  h2: "text-3xl leading-tight font-semibold",
  h3: "text-2xl leading-snug font-semibold",
  lead: "text-lg leading-relaxed text-muted",
  body: "text-base leading-normal",
  small: "text-sm leading-snug",
  muted: "text-sm text-muted",
};

type OwnProps = {
  variant?: Variant;
  font?: Font;
  className?: string;
};

type PolymorphicProps<E extends HtmlOnly> = {
  as?: E;
} & OwnProps & Omit<React.ComponentPropsWithoutRef<E>, keyof OwnProps | "as">;

export function Typography<E extends HtmlOnly = "p">({
  as,
  variant = "body",
  font = "primary",
  className,
  ...rest
}: PolymorphicProps<E>) {
  const Tag = (as ?? "p") as HtmlOnly;
  const fontClass = font === "secondary" ? "font-secondary" : "font-primary";
  return (
    <Tag className={clsx(styles[variant], fontClass, "text-fg", className)} {...rest as any} />
  );
}
