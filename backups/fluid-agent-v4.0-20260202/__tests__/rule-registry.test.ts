import { describe, it, expect, beforeEach } from 'vitest';
import { ruleRegistry } from '../prediction/rule-registry';
import type { PredictionRule } from '../types';

describe('RuleRegistry', () => {
  beforeEach(() => {
    ruleRegistry.clear();
  });

  it('should register a single rule', () => {
    const rule: PredictionRule = {
      id: 'test_rule',
      name: 'Test Rule',
      icon: '📝',
      priority: 50,
      category: 'content',
      enabled: true,
      condition: () => true,
      action: 'test_action',
    };

    ruleRegistry.register(rule);

    expect(ruleRegistry.getById('test_rule')).toBeDefined();
    expect(ruleRegistry.getById('test_rule')?.name).toBe('Test Rule');
  });

  it('should register multiple rules', () => {
    const rules: PredictionRule[] = [
      { id: 'r1', name: 'R1', icon: '1', priority: 50, category: 'content', enabled: true, condition: () => true, action: 'a1' },
      { id: 'r2', name: 'R2', icon: '2', priority: 60, category: 'content', enabled: true, condition: () => true, action: 'a2' },
    ];

    ruleRegistry.registerMany(rules);

    expect(ruleRegistry.getAll()).toHaveLength(2);
  });

  it('should return rules sorted by priority (descending)', () => {
    ruleRegistry.registerMany([
      { id: 'low', name: 'Low', icon: '📝', priority: 10, category: 'content', enabled: true, condition: () => true, action: 'a1' },
      { id: 'high', name: 'High', icon: '📝', priority: 90, category: 'content', enabled: true, condition: () => true, action: 'a2' },
      { id: 'mid', name: 'Mid', icon: '📝', priority: 50, category: 'content', enabled: true, condition: () => true, action: 'a3' },
    ]);

    const all = ruleRegistry.getAll();

    expect(all[0].id).toBe('high');
    expect(all[1].id).toBe('mid');
    expect(all[2].id).toBe('low');
  });

  it('should filter enabled rules only', () => {
    ruleRegistry.registerMany([
      { id: 'enabled', name: 'Enabled', icon: '✅', priority: 50, category: 'content', enabled: true, condition: () => true, action: 'a1' },
      { id: 'disabled', name: 'Disabled', icon: '❌', priority: 60, category: 'content', enabled: false, condition: () => true, action: 'a2' },
    ]);

    const enabled = ruleRegistry.getEnabled();

    expect(enabled).toHaveLength(1);
    expect(enabled[0].id).toBe('enabled');
  });

  it('should update rule enabled status', () => {
    ruleRegistry.register({
      id: 'test',
      name: 'Test',
      icon: '📝',
      priority: 50,
      category: 'content',
      enabled: true,
      condition: () => true,
      action: 'test',
    });

    ruleRegistry.setEnabled('test', false);

    expect(ruleRegistry.getById('test')?.enabled).toBe(false);
    expect(ruleRegistry.getEnabled()).toHaveLength(0);
  });

  it('should update rule priority', () => {
    ruleRegistry.register({
      id: 'test',
      name: 'Test',
      icon: '📝',
      priority: 50,
      category: 'content',
      enabled: true,
      condition: () => true,
      action: 'test',
    });

    ruleRegistry.setPriority('test', 80);

    expect(ruleRegistry.getById('test')?.priority).toBe(80);
  });

  it('should clamp priority between 0 and 100', () => {
    ruleRegistry.register({
      id: 'test',
      name: 'Test',
      icon: '📝',
      priority: 50,
      category: 'content',
      enabled: true,
      condition: () => true,
      action: 'test',
    });

    ruleRegistry.setPriority('test', 150);
    expect(ruleRegistry.getById('test')?.priority).toBe(100);

    ruleRegistry.setPriority('test', -10);
    expect(ruleRegistry.getById('test')?.priority).toBe(0);
  });

  it('should get rules by category', () => {
    ruleRegistry.registerMany([
      { id: 'lang1', name: 'Lang1', icon: '🌐', priority: 50, category: 'language', enabled: true, condition: () => true, action: 'a1' },
      { id: 'content1', name: 'Content1', icon: '📝', priority: 50, category: 'content', enabled: true, condition: () => true, action: 'a2' },
      { id: 'lang2', name: 'Lang2', icon: '🌐', priority: 60, category: 'language', enabled: true, condition: () => true, action: 'a3' },
    ]);

    const langRules = ruleRegistry.getByCategory('language');

    expect(langRules).toHaveLength(2);
    expect(langRules.every(r => r.category === 'language')).toBe(true);
  });

  it('should clear all rules', () => {
    ruleRegistry.registerMany([
      { id: 'r1', name: 'R1', icon: '1', priority: 50, category: 'content', enabled: true, condition: () => true, action: 'a1' },
      { id: 'r2', name: 'R2', icon: '2', priority: 60, category: 'content', enabled: true, condition: () => true, action: 'a2' },
    ]);

    ruleRegistry.clear();

    expect(ruleRegistry.getAll()).toHaveLength(0);
  });
});
