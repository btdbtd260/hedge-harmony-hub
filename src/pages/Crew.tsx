import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { crewMembers as mockCrew, jobs as mockJobs } from "@/data/mock";

const Crew = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Crew Management</h1>
        <p className="text-muted-foreground">View team members and assignments</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mockCrew.map((member) => {
          const assignedJobs = mockJobs.filter((j) => j.crewId === member.id && j.status !== "completed");
          return (
            <Card key={member.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{member.name}</CardTitle>
                  <Badge variant={member.active ? "default" : "secondary"}>
                    {member.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-1">
                  <p className="text-muted-foreground">{member.role}</p>
                  <p className="text-muted-foreground">{member.phone}</p>
                </div>
                {assignedJobs.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Current Assignments</p>
                    {assignedJobs.map((job) => (
                      <div key={job.id} className="text-sm p-2 rounded border mb-1">
                        <span className="font-medium">{job.customerName}</span>
                        <span className="text-muted-foreground"> · {job.scheduledDate}</span>
                      </div>
                    ))}
                  </div>
                )}
                {assignedJobs.length === 0 && member.active && (
                  <p className="text-sm text-muted-foreground italic">No current assignments</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Crew;
