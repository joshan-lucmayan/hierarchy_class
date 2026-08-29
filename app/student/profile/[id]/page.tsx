import { ViewStudentProfile } from "@/components/student/ViewStudentProfile";

/**
 * Web deep-link route for another person's profile
 * (/student/profile/<id>). The shared screen lives in
 * components/student/ViewStudentProfile.tsx.
 *
 * NOT part of the standalone Android bundle: dynamic path segments cannot be
 * statically exported (scripts/build-android-export.mjs moves this route
 * aside), and internal navigation on every platform uses
 * /student/profile/view?id=<id> instead. Existing web deep links keep
 * resolving through this on-demand server route.
 */
export default function ViewProfilePage({ params }: { params: { id: string } }) {
  return <ViewStudentProfile profileId={params.id} />;
}
