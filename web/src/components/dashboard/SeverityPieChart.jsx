import { Box, Text, Skeleton } from '@chakra-ui/react';
import { useColorModeValue } from '../ui/color-mode';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';

const SEVERITY_COLORS = {
  BLOCKER: '#c53030',
  CRITICAL: '#e53e3e',
  MAJOR: '#dd6b20',
  MINOR: '#d69e2e',
  INFO: '#3182ce',
};

export function SeverityPieChart({ breakdown, loading }) {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.600', 'gray.400');

  if (loading) {
    return <Skeleton height="300px" borderRadius="lg" />;
  }

  const data = (breakdown || []).map((item) => ({
    name: item.severity,
    value: parseInt(item.count || 0),
    color: SEVERITY_COLORS[item.severity] || '#a0aec0',
  }));

  const totalCount = data.reduce((sum, item) => sum + item.value, 0);

  if (totalCount === 0) {
    return (
      <Box
        bg={bgColor}
        borderWidth="1px"
        borderColor={borderColor}
        borderRadius="lg"
        p={6}
        height="300px"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Text color={textColor}>No findings data available.</Text>
      </Box>
    );
  }

  return (
    <Box
      bg={bgColor}
      borderWidth="1px"
      borderColor={borderColor}
      borderRadius="lg"
      p={4}
    >
      <Text fontSize="md" fontWeight="semibold" mb={4}>
        Severity Breakdown
      </Text>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) =>
              `${name} (${(percent * 100).toFixed(0)}%)`
            }
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: bgColor,
              borderColor: borderColor,
              borderRadius: '8px',
            }}
            formatter={(value, name) => [value, name]}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </Box>
  );
}
