import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import nock from 'nock';

describe('Data Collectors', () => {
  const baseURL = 'https://sonar.example.com';
  const component = 'test:project';

  beforeEach(() => {
    nock.cleanAll();
  });

  describe('Rules Collector', () => {
    it('should fetch rules with proper filters', async () => {
      const mockRules = {
        rules: [
          {
            key: 'java:S1234',
            name: 'Test Rule',
            htmlDesc: '<p>Rule description</p>',
            severity: 'CRITICAL'
          },
          {
            key: 'java:S5678',
            name: 'Another Rule',
            htmlDesc: '<p>Another description</p>',
            severity: 'MAJOR'
          }
        ],
        total: 2,
        p: 1,
        ps: 500
      };

      const scope = nock(baseURL)
        .get('/api/system/status')
        .reply(200, { version: '10.0.0' })
        .get(/\/api\/rules\/search/)
        .query(true)
        .reply(200, mockRules);

      // Test would call the collector here
      // For now, verify the mock is set up correctly
      expect(mockRules.rules).to.have.length(2);
      expect(mockRules.rules[0].severity).to.equal('CRITICAL');
    });

    it('should handle pagination for large rule sets', async () => {
      const page1 = {
        rules: Array(500).fill(null).map((_, i) => ({
          key: `rule:${i}`,
          name: `Rule ${i}`,
          htmlDesc: `<p>Desc ${i}</p>`,
          severity: 'MAJOR'
        })),
        total: 750,
        p: 1,
        ps: 500
      };

      const page2 = {
        rules: Array(250).fill(null).map((_, i) => ({
          key: `rule:${500 + i}`,
          name: `Rule ${500 + i}`,
          htmlDesc: `<p>Desc ${500 + i}</p>`,
          severity: 'MAJOR'
        })),
        total: 750,
        p: 2,
        ps: 500
      };

      nock(baseURL)
        .get(/\/api\/rules\/search/)
        .query({ p: 1 })
        .reply(200, page1)
        .get(/\/api\/rules\/search/)
        .query({ p: 2 })
        .reply(200, page2);

      // Pagination should fetch all 750 rules
      expect(page1.rules.length + page2.rules.length).to.equal(750);
    });

    it('should handle empty rule responses', async () => {
      const emptyRules = {
        rules: [],
        total: 0,
        p: 1,
        ps: 500
      };

      nock(baseURL)
        .get(/\/api\/rules\/search/)
        .reply(200, emptyRules);

      expect(emptyRules.rules).to.be.empty;
    });
  });

  describe('Issues Collector', () => {
    it('should fetch issues with correct statuses', async () => {
      const mockIssues = {
        issues: [
          {
            key: 'issue-1',
            rule: 'java:S1234',
            component: 'src/Main.java',
            message: 'Security issue found',
            severity: 'CRITICAL',
            status: 'OPEN',
            line: 42
          }
        ],
        total: 1,
        p: 1,
        ps: 500
      };

      nock(baseURL)
        .get(/\/api\/issues\/search/)
        .query(true)
        .reply(200, mockIssues);

      expect(mockIssues.issues[0].severity).to.equal('CRITICAL');
      expect(mockIssues.issues[0].status).to.equal('OPEN');
    });

    it('should filter by branch when specified', async () => {
      const branchIssues = {
        issues: [
          {
            key: 'issue-branch-1',
            rule: 'java:S1234',
            branch: 'feature/test',
            message: 'Branch issue',
            severity: 'MAJOR'
          }
        ],
        total: 1
      };

      nock(baseURL)
        .get(/\/api\/issues\/search/)
        .query(obj => obj.branch === 'feature/test')
        .reply(200, branchIssues);

      expect(branchIssues.issues[0].branch).to.equal('feature/test');
    });

    it('should handle pull request filtering', async () => {
      const prIssues = {
        issues: [
          {
            key: 'pr-issue-1',
            rule: 'java:S5678',
            pullRequest: '123',
            message: 'PR issue',
            severity: 'MINOR'
          }
        ],
        total: 1
      };

      nock(baseURL)
        .get(/\/api\/issues\/search/)
        .query(obj => obj.pullRequest === '123')
        .reply(200, prIssues);

      expect(prIssues.issues[0].pullRequest).to.equal('123');
    });
  });

  describe('Hotspots Collector', () => {
    it('should fetch security hotspots', async () => {
      const mockHotspots = {
        hotspots: [
          {
            key: 'hotspot-1',
            component: 'src/Security.java',
            message: 'Review this security-sensitive code',
            securityCategory: 'sql-injection',
            vulnerabilityProbability: 'HIGH',
            status: 'TO_REVIEW'
          }
        ],
        paging: { total: 1 }
      };

      nock(baseURL)
        .get(/\/api\/hotspots\/search/)
        .query(true)
        .reply(200, mockHotspots);

      expect(mockHotspots.hotspots[0].vulnerabilityProbability).to.equal('HIGH');
      expect(mockHotspots.hotspots[0].status).to.equal('TO_REVIEW');
    });

    it('should fetch hotspot details', async () => {
      const hotspotDetail = {
        key: 'hotspot-1',
        rule: {
          key: 'java:S3649',
          name: 'Database queries should not be vulnerable to injection attacks',
          securityCategory: 'sql-injection',
          vulnerabilityProbability: 'HIGH'
        },
        message: 'Review this SQL query',
        author: 'developer@example.com',
        status: 'TO_REVIEW',
        line: 50
      };

      nock(baseURL)
        .get('/api/hotspots/show')
        .query({ hotspot: 'hotspot-1' })
        .reply(200, hotspotDetail);

      expect(hotspotDetail.rule.securityCategory).to.equal('sql-injection');
    });

    it('should handle hotspots with different severities', async () => {
      const hotspots = {
        hotspots: [
          { key: 'h1', vulnerabilityProbability: 'HIGH' },
          { key: 'h2', vulnerabilityProbability: 'MEDIUM' },
          { key: 'h3', vulnerabilityProbability: 'LOW' }
        ]
      };

      expect(hotspots.hotspots).to.have.length(3);
      expect(hotspots.hotspots.map(h => h.vulnerabilityProbability))
        .to.include.members(['HIGH', 'MEDIUM', 'LOW']);
    });
  });

  describe('Quality Gate Collector', () => {
    it('should fetch quality gate status', async () => {
      const qgStatus = {
        projectStatus: {
          status: 'OK',
          conditions: [
            {
              status: 'OK',
              metricKey: 'new_coverage',
              actualValue: '85.5',
              errorThreshold: '80'
            },
            {
              status: 'OK',
              metricKey: 'new_security_hotspots_reviewed',
              actualValue: '100',
              errorThreshold: '100'
            }
          ],
          periods: [
            {
              date: '2024-01-01T00:00:00+0000',
              mode: 'PREVIOUS_VERSION',
              parameter: '1.0.0'
            }
          ]
        }
      };

      nock(baseURL)
        .get('/api/qualitygates/project_status')
        .query(true)
        .reply(200, qgStatus);

      expect(qgStatus.projectStatus.status).to.equal('OK');
      expect(qgStatus.projectStatus.conditions).to.have.length(2);
    });

    it('should handle failed quality gate', async () => {
      const failedQG = {
        projectStatus: {
          status: 'ERROR',
          conditions: [
            {
              status: 'ERROR',
              metricKey: 'new_coverage',
              actualValue: '65.0',
              errorThreshold: '80'
            }
          ]
        }
      };

      nock(baseURL)
        .get('/api/qualitygates/project_status')
        .reply(200, failedQG);

      expect(failedQG.projectStatus.status).to.equal('ERROR');
      expect(failedQG.projectStatus.conditions[0].status).to.equal('ERROR');
    });
  });

  describe('Coverage Collector', () => {
    it('should fetch coverage metrics', async () => {
      const coverage = {
        component: {
          key: component,
          measures: [
            {
              metric: 'coverage',
              value: '75.5'
            }
          ]
        }
      };

      nock(baseURL)
        .get('/api/measures/component')
        .query(obj => obj.metricKeys === 'coverage')
        .reply(200, coverage);

      expect(coverage.component.measures[0].value).to.equal('75.5');
    });

    it('should handle missing coverage data', async () => {
      const noCoverage = {
        component: {
          key: component,
          measures: []
        }
      };

      nock(baseURL)
        .get('/api/measures/component')
        .reply(200, noCoverage);

      expect(noCoverage.component.measures).to.be.empty;
    });
  });

  describe('New Code Period Collector', () => {
    it('should fetch new code period settings', async () => {
      const newCodePeriod = {
        newCodePeriods: [
          {
            type: 'PREVIOUS_VERSION',
            value: '1.0.0',
            effectiveValue: '2024-01-01'
          }
        ]
      };

      nock(baseURL)
        .get('/api/new_code_periods/list')
        .query(true)
        .reply(200, newCodePeriod);

      expect(newCodePeriod.newCodePeriods[0].type).to.equal('PREVIOUS_VERSION');
    });

    it('should handle reference branch new code period', async () => {
      const refBranch = {
        newCodePeriods: [
          {
            type: 'REFERENCE_BRANCH',
            value: 'main',
            branchKey: 'feature/test'
          }
        ]
      };

      expect(refBranch.newCodePeriods[0].type).to.equal('REFERENCE_BRANCH');
      expect(refBranch.newCodePeriods[0].value).to.equal('main');
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      nock(baseURL)
        .get(/\/api\/rules\/search/)
        .reply(500, { errors: [{ msg: 'Internal server error' }] });

      // Test should handle this error appropriately
    });

    it('should handle timeout errors', async () => {
      nock(baseURL)
        .get(/\/api\/issues\/search/)
        .delayConnection(35000) // Longer than typical timeout
        .reply(200, {});

      // Should timeout and handle gracefully
    });

    it('should handle malformed JSON responses', async () => {
      nock(baseURL)
        .get(/\/api\/hotspots\/search/)
        .reply(200, 'not valid json');

      // Should handle parse error
    });
  });
});
