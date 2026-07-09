import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  if (!req.auth) {
    const signin = new URL("/signin", req.nextUrl.origin);
    signin.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(signin);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/studio/:path*", "/credits/:path*", "/account/:path*"],
};
