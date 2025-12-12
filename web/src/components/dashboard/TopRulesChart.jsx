import { Box, Text, Skeleton } from '@chakra-ui/react';
import { useColorModeValue } from '../ui/color-mode';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const SEVERITY_COLORS = {
  BLOCKER: '#c53030',
  CRITICAL: '#e53e3e',
  MAJOR: '#dd6b20',
  MINOR: '#d69e2e',
  INFO: '#3182ce',
};

export function TopRulesChart({ topRules, loading }) {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.600', 'gray.400');
  const gridColor = useColorModeValue('#e2e8f0', '#4a5568');

  if (loading) {
    return <Skeleton height="300px" borderRadius="lg" />;
  }

  const data = (topRules || []).slice(0, 8).map((rule) => ({
    name: rule.rule_name || rule.rule_key,
    shortName: (rule.rule_name || rule.rule_key).substring(0, 25) +
      ((rule.rule_name || rule.rule_key).length > 25 ? '...' : ''),
    count: parseInt(rule.count || 0),
    severity: rule.max_severity,
    color: SEVERITY_COLORS[rule.max_severity] || '#3182ce',
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
        <Text color={textColor}>No rule data available.</Text>
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
        Top Violated Rules
      </Text>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 20, right: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis
            type="number"
            tick={{ fill: textColor, fontSize: 12 }}
            tickLine={{ stroke: gridColor }}
          />
          <YAxis
            type="category"
            dataKey="shortName"
            tick={{ fill: textColor, fontSize: 11 }}
            tickLine={{ stroke: gridColor }}
            width={150}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: bgColor,
              borderColor: borderColor,
              borderRadius: '8px',
            }}
            formatter={(value, name, props) => [value, props.payload.name]}
            labelFormatter={() => ''}
          />
          <Bar dataKey="count" name="Count" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
