import { useState } from 'react';
import { ChakraProvider, Container, VStack, Tabs, Box, defaultSystem } from '@chakra-ui/react';
import { ReportForm } from './components/ReportForm';
import { Header } from './components/Header';
import { ReportHistory } from './components/ReportHistory';
import { Dashboard } from './components/dashboard/Dashboard';
import { ProjectForm } from './components/projects/ProjectForm';
import { Toaster } from './components/ui/toaster';
import { useProjects } from './hooks/useProjects';

export function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const { createProject, updateProject } = useProjects();

  const handleAddProject = () => {
    setEditingProject(null);
    setProjectFormOpen(true);
  };

  const handleEditProject = (project) => {
    setEditingProject(project);
    setProjectFormOpen(true);
  };

  const handleProjectSubmit = async (data) => {
    if (editingProject) {
      await updateProject(editingProject.id, data);
    } else {
      await createProject(data);
    }
    setProjectFormOpen(false);
    setEditingProject(null);
  };

  return (
    <ChakraProvider value={defaultSystem}>
      <Toaster />
      <Container maxW="container.xl" py={8}>
        <VStack gap={6} align="stretch">
          <Header />

          <Tabs.Root
            value={activeTab}
            onValueChange={(e) => setActiveTab(e.value)}
          >
            <Tabs.List>
              <Tabs.Trigger value="dashboard">Dashboard</Tabs.Trigger>
              <Tabs.Trigger value="reports">Report Generator</Tabs.Trigger>
            </Tabs.List>

            <Box mt={6}>
              <Tabs.Content value="dashboard">
                <Dashboard
                  onAddProject={handleAddProject}
                  onEditProject={handleEditProject}
                />
              </Tabs.Content>

              <Tabs.Content value="reports">
                <VStack gap={6} align="stretch">
                  <ReportHistory />
                  <ReportForm />
                </VStack>
              </Tabs.Content>
            </Box>
          </Tabs.Root>

          {/* Project Form Modal */}
          <ProjectForm
            isOpen={projectFormOpen}
            onClose={() => {
              setProjectFormOpen(false);
              setEditingProject(null);
            }}
            onSubmit={handleProjectSubmit}
            project={editingProject}
          />
        </VStack>
      </Container>
    </ChakraProvider>
  );
}
