import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      // Backend-hosted property/listing photos (uploaded via /properties/{uuid}/images).
      {
        protocol: 'https',
        hostname: 'guest.hit.tools',
      },
      // Legacy backend host — old image URLs stored before the domain move.
      {
        protocol: 'https',
        hostname: 'www.kunas.co',
      },
      {
        protocol: 'https',
        hostname: 'kunas.co',
      },
      // S3 buckets / AWS-hosted assets the backend may return.
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
      // Marketing-hosted brand assets (logo), same PNG already used in the
      // check-in invitation emails (email-templates/*.html).
      {
        protocol: 'https',
        hostname: 'hitguest.com',
      },
    ],
  },
};

export default nextConfig;
