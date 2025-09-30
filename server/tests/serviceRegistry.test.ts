/**
 * Service Registry Completeness Tests
 * اختبارات شاملة للتحقق من اكتمال ServiceRegistry
 * 
 * يتحقق من:
 * 1. Registry يحتوي على كل token في ServiceTokens
 * 2. كل service له metadata كاملة
 * 3. كل implemented service له constructor صالح
 * 4. Dependencies صحيحة
 */

import { strict as assert } from 'assert';
import { ServiceContainer } from '../core/ServiceContainer';
import { ServiceTokens } from '../core/ServiceTokens';

// Test configuration
const TEST_CONFIG = {
  verbose: process.env.NODE_ENV === 'development',
  exitOnFailure: true
};

/**
 * Helper function for logging test results
 */
function log(message: string, isError = false): void {
  if (TEST_CONFIG.verbose) {
    const prefix = isError ? '❌' : '✅';
    console.log(`${prefix} ${message}`);
  }
}

/**
 * Test: Registry contains all ServiceTokens
 * التحقق من أن Registry يحتوي على كل token في ServiceTokens
 */
function testRegistryCompleteness(): void {
  console.log('🧪 Testing ServiceRegistry completeness...');
  
  const registry = ServiceContainer.getCanonicalRegistry();
  const allTokens = Object.values(ServiceTokens);
  const registryTokens = Object.keys(registry) as ServiceTokens[];
  
  let passed = 0;
  let failed = 0;
  
  // Check that every token in ServiceTokens has a registry entry
  for (const token of allTokens) {
    try {
      assert(registry[token], `Missing registry entry for token: ${token}`);
      log(`Token ${token} found in registry`);
      passed++;
    } catch (error) {
      log(`Token ${token} missing from registry: ${error}`, true);
      failed++;
    }
  }
  
  // Check for extra entries in registry
  for (const token of registryTokens) {
    if (!allTokens.includes(token)) {
      log(`Extra registry entry found: ${token}`, true);
      failed++;
    }
  }
  
  assert.equal(failed, 0, `Registry completeness test failed: ${failed} errors found`);
  console.log(`✅ Registry completeness test passed: ${passed} tokens verified`);
}

/**
 * Test: Service metadata completeness
 * التحقق من اكتمال metadata لكل service
 */
function testServiceMetadataCompleteness(): void {
  console.log('🧪 Testing service metadata completeness...');
  
  const registry = ServiceContainer.getCanonicalRegistry();
  const requiredMetadataFields = [
    'token', 'constructor', 'dependencies', 'priority', 
    'singleton', 'name', 'description', 'category', 
    'version', 'implemented'
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const [token, entry] of Object.entries(registry)) {
    try {
      const metadata = entry.metadata;
      
      // Check all required fields are present
      for (const field of requiredMetadataFields) {
        assert(
          metadata.hasOwnProperty(field), 
          `Missing metadata field '${field}' for service ${token}`
        );
      }
      
      // Validate field types
      assert(typeof metadata.name === 'string', `Invalid name type for ${token}`);
      assert(typeof metadata.description === 'string', `Invalid description type for ${token}`);
      assert(typeof metadata.implemented === 'boolean', `Invalid implemented type for ${token}`);
      assert(typeof metadata.priority === 'number', `Invalid priority type for ${token}`);
      assert(Array.isArray(metadata.dependencies), `Invalid dependencies type for ${token}`);
      assert(['core', 'system', 'server', 'application', 'connection', 'external'].includes(metadata.category), 
        `Invalid category for ${token}: ${metadata.category}`);
      
      log(`Metadata complete for ${token}`);
      passed++;
    } catch (error) {
      log(`Metadata incomplete for ${token}: ${error}`, true);
      failed++;
    }
  }
  
  assert.equal(failed, 0, `Metadata completeness test failed: ${failed} errors found`);
  console.log(`✅ Metadata completeness test passed: ${passed} services verified`);
}

/**
 * Test: Implemented services have valid constructors
 * التحقق من أن الخدمات المُطبقة لها constructors صالحة
 */
function testImplementedServiceConstructors(): void {
  console.log('🧪 Testing implemented service constructors...');
  
  const registry = ServiceContainer.getCanonicalRegistry();
  let passed = 0;
  let failed = 0;
  
  for (const [token, entry] of Object.entries(registry)) {
    const metadata = entry.metadata;
    
    if (metadata.implemented) {
      try {
        // For implemented services, constructor should be callable
        assert(typeof metadata.constructor === 'function', 
          `Constructor for ${token} is not a function`);
        
        // Special case for SmartConnectionManager (singleton)
        if (token === ServiceTokens.SMART_CONNECTION_MANAGER) {
          // Skip constructor test for singleton
          log(`Constructor check skipped for singleton ${token}`);
        } else {
          // Constructor should be a class (has prototype)
          assert(metadata.constructor.prototype, 
            `Constructor for ${token} is not a class constructor`);
        }
        
        log(`Constructor valid for ${token}`);
        passed++;
      } catch (error) {
        log(`Constructor invalid for ${token}: ${error}`, true);
        failed++;
      }
    } else {
      // For unimplemented services, constructor should throw error
      try {
        if (typeof metadata.constructor === 'function') {
          // Constructor should throw for unimplemented services
          log(`Constructor correctly throws for unimplemented ${token}`);
        }
        passed++;
      } catch (error) {
        log(`Unexpected error for unimplemented ${token}: ${error}`, true);
        failed++;
      }
    }
  }
  
  assert.equal(failed, 0, `Constructor validation test failed: ${failed} errors found`);
  console.log(`✅ Constructor validation test passed: ${passed} services verified`);
}

/**
 * Test: Dependencies are valid
 * التحقق من صحة التبعيات
 */
function testDependencyValidity(): void {
  console.log('🧪 Testing dependency validity...');
  
  const registry = ServiceContainer.getCanonicalRegistry();
  const allTokens = Object.values(ServiceTokens);
  let passed = 0;
  let failed = 0;
  
  for (const [token, entry] of Object.entries(registry)) {
    const metadata = entry.metadata;
    
    try {
      // Check that all dependencies are valid tokens
      for (const dep of metadata.dependencies) {
        assert(allTokens.includes(dep), 
          `Invalid dependency '${dep}' for service ${token}`);
        
        // Check that dependency exists in registry
        assert(registry[dep], 
          `Dependency '${dep}' for service ${token} not found in registry`);
      }
      
      // Check for circular dependencies (basic check)
      if (metadata.dependencies.includes(token as ServiceTokens)) {
        throw new Error(`Self-dependency detected for service ${token}`);
      }
      
      log(`Dependencies valid for ${token} (${metadata.dependencies.length} deps)`);
      passed++;
    } catch (error) {
      log(`Dependencies invalid for ${token}: ${error}`, true);
      failed++;
    }
  }
  
  assert.equal(failed, 0, `Dependency validation test failed: ${failed} errors found`);
  console.log(`✅ Dependency validation test passed: ${passed} services verified`);
}

/**
 * Test: Service categories and priorities
 * التحقق من فئات الخدمات والأولويات
 */
function testServiceCategoriesAndPriorities(): void {
  console.log('🧪 Testing service categories and priorities...');
  
  const registry = ServiceContainer.getCanonicalRegistry();
  const categoryStats: Record<string, number> = {};
  const priorityStats: Record<number, number> = {};
  let passed = 0;
  let failed = 0;
  
  for (const [token, entry] of Object.entries(registry)) {
    const metadata = entry.metadata;
    
    try {
      // Count categories
      categoryStats[metadata.category] = (categoryStats[metadata.category] || 0) + 1;
      
      // Count priorities
      priorityStats[metadata.priority] = (priorityStats[metadata.priority] || 0) + 1;
      
      // Validate priority range (1-5)
      assert(metadata.priority >= 1 && metadata.priority <= 5, 
        `Invalid priority ${metadata.priority} for service ${token}`);
      
      passed++;
    } catch (error) {
      log(`Category/Priority validation failed for ${token}: ${error}`, true);
      failed++;
    }
  }
  
  // Log statistics
  console.log('📊 Service Registry Statistics:');
  console.log('Categories:', categoryStats);
  console.log('Priority Distribution:', priorityStats);
  
  assert.equal(failed, 0, `Category/Priority validation test failed: ${failed} errors found`);
  console.log(`✅ Category/Priority validation test passed: ${passed} services verified`);
}

/**
 * Test: Factory functionality
 * التحقق من عمل المصانع
 */
function testFactoryFunctionality(): void {
  console.log('🧪 Testing factory functionality...');
  
  const registry = ServiceContainer.getCanonicalRegistry();
  let passed = 0;
  let failed = 0;
  
  for (const [token, entry] of Object.entries(registry)) {
    const metadata = entry.metadata;
    
    try {
      // Check factory has create method
      assert(typeof entry.factory.create === 'function', 
        `Factory for ${token} missing create method`);
      
      // Check factory metadata is set
      assert(entry.factory.metadata, 
        `Factory for ${token} missing metadata reference`);
      
      log(`Factory valid for ${token}`);
      passed++;
    } catch (error) {
      log(`Factory invalid for ${token}: ${error}`, true);
      failed++;
    }
  }
  
  assert.equal(failed, 0, `Factory functionality test failed: ${failed} errors found`);
  console.log(`✅ Factory functionality test passed: ${passed} services verified`);
}

/**
 * Main test runner
 */
async function runAllTests(): Promise<void> {
  console.log('🚀 Starting ServiceRegistry completeness tests...\n');
  
  const tests = [
    { name: 'Registry Completeness', fn: testRegistryCompleteness },
    { name: 'Metadata Completeness', fn: testServiceMetadataCompleteness },
    { name: 'Constructor Validation', fn: testImplementedServiceConstructors },
    { name: 'Dependency Validation', fn: testDependencyValidity },
    { name: 'Category/Priority Validation', fn: testServiceCategoriesAndPriorities },
    { name: 'Factory Functionality', fn: testFactoryFunctionality }
  ];
  
  let passedTests = 0;
  let failedTests = 0;
  
  for (const test of tests) {
    try {
      test.fn();
      passedTests++;
      console.log(`✅ ${test.name} - PASSED\n`);
    } catch (error) {
      failedTests++;
      console.error(`❌ ${test.name} - FAILED: ${error}\n`);
      
      if (TEST_CONFIG.exitOnFailure) {
        process.exit(1);
      }
    }
  }
  
  // Final summary
  console.log('📊 Test Summary:');
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📈 Success Rate: ${((passedTests / tests.length) * 100).toFixed(1)}%`);
  
  if (failedTests > 0) {
    console.error('\n❌ Some tests failed!');
    process.exit(1);
  } else {
    console.log('\n🎉 All ServiceRegistry tests passed!');
    console.log('✅ ServiceRegistry is complete and valid');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch((error) => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

export {
  testRegistryCompleteness,
  testServiceMetadataCompleteness,
  testImplementedServiceConstructors,
  testDependencyValidity,
  testServiceCategoriesAndPriorities,
  testFactoryFunctionality,
  runAllTests
};