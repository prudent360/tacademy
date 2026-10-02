/**
 * Links that open LinkedIn with a certificate filled in: "Add to profile" pre-fills the Licenses & certifications
 * form (name, issuer, issue date, credential ID and the verification link); "Share" starts a post with the
 * certificate page, whose preview image is generated from the certificate (certificates/[code]/opengraph-image).
 */
export function linkedInLinks({ course, organisation, issuedAt, url, code }: { course: string; organisation: string; issuedAt: Date; url: string; code: string }) {
  const add = new URL("https://www.linkedin.com/profile/add");
  add.search = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: course,
    organizationName: organisation,
    issueYear: String(issuedAt.getUTCFullYear()),
    issueMonth: String(issuedAt.getUTCMonth() + 1),
    certUrl: url,
    certId: code,
  }).toString();
  const share = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
  return { add: add.toString(), share };
}
