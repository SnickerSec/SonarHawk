import { Box, Text, Skeleton } from '@chakra-ui/react';
import { useColorModeValue } from '../ui/color-mode';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export function TrendChart({ trends, loading }) {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.600', 'gray.400');
  const gridColor = useColorModeValue('#e2e8f0', '#4a5568');

  if (loading) {
    return <Skeleton height="300px" borderRadius="lg" />;
  }

  // Format data for the chart
  const data = [...(trends || [])]
    .reverse()
    .map((scan) => ({
      date: new Date(scan.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      total: parseInt(scan.total_issues || 0),
      critical: parseInt(scan.blocker_count || 0) + parseInt(scan.critical_count || 0),
      major: parseInt(scan.major_count || 0),
      minor: parseInt(scan.minor_count || 0),
    }));

  if (data.length === 0) {
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
        <Text color={textColor}>No trend data available. Sync your project to start tracking.</Text>
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
        Findings Trend
      </Text>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis
            dataKey="date"
            tick={{ fill: textColor, fontSize: 12 }}
            tickLine={{ stroke: gridColor }}
          />
          <YAxis
            tick={{ fill: textColor, fontSize: 12 }}
            tickLine={{ stroke: gridColor }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: bgColor,
              borderColor: borderColor,
              borderRadius: '8px',
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="total"
            name="Total"
            stroke="#3182ce"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="critical"
            name="Critical"
            stroke="#e53e3e"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="major"
            name="Major"
            stroke="#dd6b20"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}
