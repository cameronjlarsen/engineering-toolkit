import type { ParentHost, RoleMap, Route } from "./route.ts";

declare const route: Route;

const whyRoute: RoleMap["why investigators, synthesizer"] = {
  // @ts-expect-error Why is bound to inherit-parent or auto.
  kind: "route",
  route,
};

const reflectRoute: RoleMap["reflect tooling, judgment, divergent, synthesizer"] = {
  // @ts-expect-error Reflect is bound to inherit-parent or auto.
  kind: "route",
  route,
};

const cursorParent: ParentHost = "cursor";

// @ts-expect-error Grok is not a parent host.
const grokParent: ParentHost = "grok";

void [whyRoute, reflectRoute, cursorParent, grokParent];
