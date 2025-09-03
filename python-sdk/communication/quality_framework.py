#!/usr/bin/env python3
"""
Quality Gate Validation Framework
===============================

This module provides a comprehensive quality gate validation framework
for ensuring high-quality outputs from agent coordination workflows.

Key Features:
- Configurable quality gates with custom criteria
- Automated validation with scoring algorithms
- Manual review workflows for human oversight
- Quality metrics tracking and reporting
- Integration with agent communication protocol
- Extensible validator plugin system
"""

import asyncio
import json
import time
from typing import Dict, List, Optional, Any, Callable, Union, Tuple
from dataclasses import dataclass, field, asdict
from enum import Enum
from abc import ABC, abstractmethod
import logging
import re

from .protocol import (
    ProtocolMessage, MessageType, AgentRole, ValidationResult,
    QualityGate, ProtocolEngine
)

logger = logging.getLogger(__name__)

# ============================================================================
# Quality Gate Types and Enums
# ============================================================================

class ValidationType(Enum):
    """Types of quality validation"""
    AUTOMATED = "automated"
    MANUAL = "manual"
    HYBRID = "hybrid"

class QualityCriterion(Enum):
    """Quality criteria for validation"""
    SYNTAX_VALID = "syntax_valid"
    BEST_PRACTICES = "best_practices"
    DOCUMENTATION = "documentation"
    TEST_COVERAGE = "test_coverage"
    PERFORMANCE = "performance"
    SECURITY = "security"
    REQUIREMENTS_MET = "requirements_met"
    ERROR_HANDLING = "error_handling"
    CODE_QUALITY = "code_quality"
    FUNCTIONALITY = "functionality"

@dataclass
class QualityScore:
    """Quality score for a specific criterion"""
    criterion: QualityCriterion
    score: float  # 0.0 to 1.0
    weight: float = 1.0
    feedback: List[str] = field(default_factory=list)
    evidence: Dict[str, Any] = field(default_factory=dict)
    validator_name: str = "unknown"

@dataclass
class ValidationContext:
    """Context for quality validation"""
    task_id: str
    session_id: str
    task_output: Dict[str, Any]
    task_requirements: List[str] = field(default_factory=list)
    code_files: List[str] = field(default_factory=list)
    test_files: List[str] = field(default_factory=list)
    documentation: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class QualityGateConfig:
    """Configuration for quality gate"""
    gate_id: str
    name: str
    description: str
    validation_type: ValidationType = ValidationType.AUTOMATED
    threshold_score: float = 0.8
    required: bool = True
    timeout_seconds: int = 300
    retry_attempts: int = 2
    criteria_weights: Dict[QualityCriterion, float] = field(default_factory=dict)
    custom_validators: List[str] = field(default_factory=list)
    
    def __post_init__(self):
        # Set default weights if not provided
        if not self.criteria_weights:
            self.criteria_weights = {
                QualityCriterion.SYNTAX_VALID: 1.0,
                QualityCriterion.REQUIREMENTS_MET: 1.0,
                QualityCriterion.FUNCTIONALITY: 0.8,
                QualityCriterion.BEST_PRACTICES: 0.6,
                QualityCriterion.DOCUMENTATION: 0.4
            }

# ============================================================================
# Abstract Validator Base Class
# ============================================================================

class QualityValidator(ABC):
    """
    Abstract base class for quality validators.
    
    Validators implement specific quality checks and return scores
    with detailed feedback for improvement.
    """
    
    def __init__(self, name: str, description: str = ""):
        self.name = name
        self.description = description
        self.supported_criteria: List[QualityCriterion] = []
    
    @abstractmethod
    async def validate(self, context: ValidationContext, criteria: List[QualityCriterion]) -> List[QualityScore]:
        """
        Validate quality based on specified criteria.
        
        Args:
            context: Validation context with task output and metadata
            criteria: List of quality criteria to evaluate
            
        Returns:
            List of quality scores for evaluated criteria
        """
        pass
    
    def supports_criterion(self, criterion: QualityCriterion) -> bool:
        """Check if validator supports a specific criterion"""
        return criterion in self.supported_criteria

# ============================================================================
# Built-in Validators
# ============================================================================

class SyntaxValidator(QualityValidator):
    """Validates syntax correctness of code outputs"""
    
    def __init__(self):
        super().__init__("SyntaxValidator", "Validates syntax correctness of generated code")
        self.supported_criteria = [QualityCriterion.SYNTAX_VALID]
    
    async def validate(self, context: ValidationContext, criteria: List[QualityCriterion]) -> List[QualityScore]:
        scores = []
        
        if QualityCriterion.SYNTAX_VALID in criteria:
            score = await self._check_syntax(context)
            scores.append(score)
        
        return scores
    
    async def _check_syntax(self, context: ValidationContext) -> QualityScore:
        """Check syntax validity of code files"""
        total_files = len(context.code_files)
        valid_files = 0
        feedback = []
        evidence = {"checked_files": [], "syntax_errors": []}
        
        for file_path in context.code_files:
            try:
                # Simple syntax check (in production, would use actual parsers)
                if file_path.endswith('.py'):
                    valid = await self._check_python_syntax(file_path, context)
                elif file_path.endswith(('.js', '.ts')):
                    valid = await self._check_javascript_syntax(file_path, context)
                else:
                    valid = True  # Assume valid for unknown file types
                
                evidence["checked_files"].append(file_path)
                
                if valid:
                    valid_files += 1
                else:
                    feedback.append(f"Syntax errors found in {file_path}")
                    evidence["syntax_errors"].append(file_path)
                    
            except Exception as e:
                feedback.append(f"Error checking syntax in {file_path}: {e}")
                evidence["syntax_errors"].append({"file": file_path, "error": str(e)})
        
        if total_files == 0:
            score = 1.0  # No code files to check
            feedback.append("No code files to validate")
        else:
            score = valid_files / total_files
            if score == 1.0:
                feedback.append(f"All {total_files} files have valid syntax")
            else:
                feedback.append(f"{valid_files}/{total_files} files have valid syntax")
        
        return QualityScore(
            criterion=QualityCriterion.SYNTAX_VALID,
            score=score,
            feedback=feedback,
            evidence=evidence,
            validator_name=self.name
        )
    
    async def _check_python_syntax(self, file_path: str, context: ValidationContext) -> bool:
        """Check Python syntax (simplified implementation)"""
        try:
            # In production, would read file and use ast.parse()
            # For now, simulate syntax check
            file_content = context.task_output.get("files", {}).get(file_path, "")
            
            # Basic syntax checks
            if "def " in file_content and not file_content.count("def ") == file_content.count("return "):
                return False  # Missing returns (simplified check)
            
            # Check for common syntax issues
            syntax_issues = [
                "SyntaxError", "IndentationError", "TabError",
                "unexpected EOF", "invalid syntax"
            ]
            
            for issue in syntax_issues:
                if issue in file_content:
                    return False
            
            return True
        except Exception:
            return False
    
    async def _check_javascript_syntax(self, file_path: str, context: ValidationContext) -> bool:
        """Check JavaScript/TypeScript syntax (simplified implementation)"""
        try:
            file_content = context.task_output.get("files", {}).get(file_path, "")
            
            # Basic syntax checks
            open_braces = file_content.count("{")
            close_braces = file_content.count("}")
            
            if open_braces != close_braces:
                return False
            
            # Check for common syntax errors
            syntax_issues = ["SyntaxError", "Unexpected token", "Unexpected end of input"]
            
            for issue in syntax_issues:
                if issue in file_content:
                    return False
            
            return True
        except Exception:
            return False

class RequirementsValidator(QualityValidator):
    """Validates that output meets specified requirements"""
    
    def __init__(self):
        super().__init__("RequirementsValidator", "Validates that output meets specified requirements")
        self.supported_criteria = [QualityCriterion.REQUIREMENTS_MET, QualityCriterion.FUNCTIONALITY]
    
    async def validate(self, context: ValidationContext, criteria: List[QualityCriterion]) -> List[QualityScore]:
        scores = []
        
        if QualityCriterion.REQUIREMENTS_MET in criteria:
            score = await self._check_requirements(context)
            scores.append(score)
        
        if QualityCriterion.FUNCTIONALITY in criteria:
            score = await self._check_functionality(context)
            scores.append(score)
        
        return scores
    
    async def _check_requirements(self, context: ValidationContext) -> QualityScore:
        """Check if requirements are met"""
        total_requirements = len(context.task_requirements)
        met_requirements = 0
        feedback = []
        evidence = {"requirements_analysis": []}
        
        if total_requirements == 0:
            return QualityScore(
                criterion=QualityCriterion.REQUIREMENTS_MET,
                score=1.0,
                feedback=["No specific requirements to validate"],
                evidence=evidence,
                validator_name=self.name
            )
        
        output_text = json.dumps(context.task_output, default=str).lower()
        
        for requirement in context.task_requirements:
            met = await self._check_single_requirement(requirement, output_text, context)
            if met:
                met_requirements += 1
                feedback.append(f"✓ Requirement met: {requirement}")
            else:
                feedback.append(f"✗ Requirement not met: {requirement}")
            
            evidence["requirements_analysis"].append({
                "requirement": requirement,
                "met": met,
                "confidence": 0.8 if met else 0.2
            })
        
        score = met_requirements / total_requirements
        
        return QualityScore(
            criterion=QualityCriterion.REQUIREMENTS_MET,
            score=score,
            feedback=feedback,
            evidence=evidence,
            validator_name=self.name
        )
    
    async def _check_single_requirement(self, requirement: str, output_text: str, context: ValidationContext) -> bool:
        """Check if a single requirement is met"""
        # Simple keyword-based matching (in production, would use NLP)
        requirement_lower = requirement.lower()
        
        # Extract key terms from requirement
        key_terms = [
            word.strip() for word in re.split(r'[,\s]+', requirement_lower)
            if len(word.strip()) > 3 and word.strip() not in ['the', 'and', 'for', 'with', 'that']
        ]
        
        # Check if key terms are present in output
        matched_terms = sum(1 for term in key_terms if term in output_text)
        
        # Requirement is considered met if at least 60% of key terms are found
        return len(key_terms) == 0 or (matched_terms / len(key_terms)) >= 0.6
    
    async def _check_functionality(self, context: ValidationContext) -> QualityScore:
        """Check functionality completeness"""
        # Simplified functionality check
        output = context.task_output
        
        functionality_score = 0.0
        feedback = []
        evidence = {"functionality_checks": []}
        
        # Check if output contains code
        if output.get("files") or output.get("code"):
            functionality_score += 0.4
            feedback.append("Code output present")
            evidence["functionality_checks"].append({"check": "code_present", "passed": True})
        
        # Check if output contains executable functions/methods
        output_str = json.dumps(output, default=str)
        if "def " in output_str or "function " in output_str or "class " in output_str:
            functionality_score += 0.3
            feedback.append("Executable functions/classes found")
            evidence["functionality_checks"].append({"check": "executable_code", "passed": True})
        
        # Check if output includes error handling
        if "try" in output_str or "catch" in output_str or "except" in output_str:
            functionality_score += 0.2
            feedback.append("Error handling present")
            evidence["functionality_checks"].append({"check": "error_handling", "passed": True})
        
        # Check if output includes tests
        if output.get("test_files") or "test" in output_str.lower():
            functionality_score += 0.1
            feedback.append("Tests included")
            evidence["functionality_checks"].append({"check": "tests_present", "passed": True})
        
        return QualityScore(
            criterion=QualityCriterion.FUNCTIONALITY,
            score=min(1.0, functionality_score),
            feedback=feedback,
            evidence=evidence,
            validator_name=self.name
        )

class DocumentationValidator(QualityValidator):
    """Validates documentation quality and completeness"""
    
    def __init__(self):
        super().__init__("DocumentationValidator", "Validates documentation quality and completeness")
        self.supported_criteria = [QualityCriterion.DOCUMENTATION]
    
    async def validate(self, context: ValidationContext, criteria: List[QualityCriterion]) -> List[QualityScore]:
        scores = []
        
        if QualityCriterion.DOCUMENTATION in criteria:
            score = await self._check_documentation(context)
            scores.append(score)
        
        return scores
    
    async def _check_documentation(self, context: ValidationContext) -> QualityScore:
        """Check documentation quality"""
        doc_score = 0.0
        feedback = []
        evidence = {"documentation_checks": []}
        
        # Check for documentation files
        if context.documentation:
            doc_score += 0.4
            feedback.append(f"Documentation files present: {len(context.documentation)}")
            evidence["documentation_checks"].append({"check": "doc_files", "count": len(context.documentation)})
        
        # Check for inline comments in code
        output_str = json.dumps(context.task_output, default=str)
        comment_indicators = ["#", "//", "/*", "\"\"\"", "'''"]
        has_comments = any(indicator in output_str for indicator in comment_indicators)
        
        if has_comments:
            doc_score += 0.3
            feedback.append("Inline comments found in code")
            evidence["documentation_checks"].append({"check": "inline_comments", "passed": True})
        
        # Check for function/method documentation
        if "docstring" in output_str or "/**" in output_str:
            doc_score += 0.2
            feedback.append("Function documentation found")
            evidence["documentation_checks"].append({"check": "function_docs", "passed": True})
        
        # Check for README or similar documentation
        output_files = context.task_output.get("files", {})
        readme_files = [f for f in output_files.keys() if "readme" in f.lower() or "doc" in f.lower()]
        
        if readme_files:
            doc_score += 0.1
            feedback.append(f"README/documentation files: {readme_files}")
            evidence["documentation_checks"].append({"check": "readme", "files": readme_files})
        
        return QualityScore(
            criterion=QualityCriterion.DOCUMENTATION,
            score=min(1.0, doc_score),
            feedback=feedback,
            evidence=evidence,
            validator_name=self.name
        )

# ============================================================================
# Quality Gate Manager
# ============================================================================

class QualityGateManager:
    """
    Manages quality gates and coordinates validation processes.
    
    Features:
    - Configurable quality gates with custom validators
    - Automated and manual validation workflows
    - Quality scoring and threshold enforcement
    - Integration with agent communication protocol
    - Quality metrics tracking and reporting
    """
    
    def __init__(self, protocol_engine: Optional[ProtocolEngine] = None):
        self.protocol_engine = protocol_engine
        self.gates: Dict[str, QualityGateConfig] = {}
        self.validators: Dict[str, QualityValidator] = {}
        self.validation_history: List[ValidationResult] = []
        
        # Quality metrics
        self.metrics = {
            'total_validations': 0,
            'passed_validations': 0,
            'failed_validations': 0,
            'average_score': 0.0,
            'validation_time': 0.0
        }
        
        # Register built-in validators
        self._register_builtin_validators()
        
        # Setup default quality gates
        self._setup_default_gates()
        
        logger.info("Quality gate manager initialized")
    
    def _register_builtin_validators(self):
        """Register built-in validators"""
        validators = [
            SyntaxValidator(),
            RequirementsValidator(),
            DocumentationValidator()
        ]
        
        for validator in validators:
            self.validators[validator.name] = validator
    
    def _setup_default_gates(self):
        """Setup default quality gates"""
        default_gates = [
            QualityGateConfig(
                gate_id="basic_quality",
                name="Basic Quality Gate",
                description="Basic syntax and functionality validation",
                validation_type=ValidationType.AUTOMATED,
                threshold_score=0.7,
                criteria_weights={
                    QualityCriterion.SYNTAX_VALID: 1.0,
                    QualityCriterion.FUNCTIONALITY: 0.8
                }
            ),
            QualityGateConfig(
                gate_id="comprehensive_quality",
                name="Comprehensive Quality Gate", 
                description="Comprehensive quality validation including documentation",
                validation_type=ValidationType.AUTOMATED,
                threshold_score=0.8,
                criteria_weights={
                    QualityCriterion.SYNTAX_VALID: 1.0,
                    QualityCriterion.REQUIREMENTS_MET: 1.0,
                    QualityCriterion.FUNCTIONALITY: 0.8,
                    QualityCriterion.BEST_PRACTICES: 0.6,
                    QualityCriterion.DOCUMENTATION: 0.4
                }
            ),
            QualityGateConfig(
                gate_id="manual_review",
                name="Manual Review Gate",
                description="Requires human review and approval",
                validation_type=ValidationType.MANUAL,
                threshold_score=0.8
            )
        ]
        
        for gate in default_gates:
            self.gates[gate.gate_id] = gate
    
    def register_validator(self, validator: QualityValidator):
        """Register a custom validator"""
        self.validators[validator.name] = validator
        logger.info(f"Registered validator: {validator.name}")
    
    def register_quality_gate(self, config: QualityGateConfig):
        """Register a quality gate configuration"""
        self.gates[config.gate_id] = config
        logger.info(f"Registered quality gate: {config.gate_id}")
    
    async def validate_task_output(self, context: ValidationContext, gate_id: str = "basic_quality") -> ValidationResult:
        """
        Validate task output through specified quality gate.
        
        Args:
            context: Validation context with task output and metadata
            gate_id: ID of quality gate to use
            
        Returns:
            ValidationResult with pass/fail status and detailed feedback
        """
        start_time = time.time()
        
        if gate_id not in self.gates:
            raise ValueError(f"Quality gate '{gate_id}' not found")
        
        gate_config = self.gates[gate_id]
        
        try:
            if gate_config.validation_type == ValidationType.MANUAL:
                result = await self._manual_validation(context, gate_config)
            else:
                result = await self._automated_validation(context, gate_config)
            
            # Update metrics
            self.metrics['total_validations'] += 1
            if result.passed:
                self.metrics['passed_validations'] += 1
            else:
                self.metrics['failed_validations'] += 1
            
            # Update average score
            total_validations = self.metrics['total_validations']
            current_avg = self.metrics['average_score']
            self.metrics['average_score'] = (
                (current_avg * (total_validations - 1) + result.score) / total_validations
            )
            
            # Update validation time
            validation_time = time.time() - start_time
            self.metrics['validation_time'] = (
                (self.metrics['validation_time'] * (total_validations - 1) + validation_time) / total_validations
            )
            
            # Store in history
            self.validation_history.append(result)
            
            # Send result via protocol if available
            if self.protocol_engine:
                await self._send_validation_result(result)
            
            logger.info(f"Validation completed for task {context.task_id}: {'PASSED' if result.passed else 'FAILED'} (score: {result.score:.2f})")
            
            return result
            
        except Exception as e:
            logger.error(f"Error during validation: {e}")
            
            # Return failed validation result
            return ValidationResult(
                gate_id=gate_id,
                task_id=context.task_id,
                passed=False,
                score=0.0,
                feedback=[f"Validation error: {str(e)}"],
                timestamp=time.time()
            )
    
    async def _automated_validation(self, context: ValidationContext, gate_config: QualityGateConfig) -> ValidationResult:
        """Perform automated validation"""
        all_scores: List[QualityScore] = []
        
        # Get criteria to validate
        criteria = list(gate_config.criteria_weights.keys())
        
        # Run validators for each criterion
        for criterion in criteria:
            # Find validators that support this criterion
            supporting_validators = [
                validator for validator in self.validators.values()
                if validator.supports_criterion(criterion)
            ]
            
            if not supporting_validators:
                logger.warning(f"No validator found for criterion: {criterion}")
                continue
            
            # Use the first supporting validator (could be enhanced to use multiple)
            validator = supporting_validators[0]
            
            try:
                scores = await validator.validate(context, [criterion])
                all_scores.extend(scores)
            except Exception as e:
                logger.error(f"Error in validator {validator.name} for criterion {criterion}: {e}")
                # Add a failed score
                all_scores.append(QualityScore(
                    criterion=criterion,
                    score=0.0,
                    feedback=[f"Validator error: {str(e)}"],
                    validator_name=validator.name
                ))
        
        # Calculate weighted overall score
        if not all_scores:
            return ValidationResult(
                gate_id=gate_config.gate_id,
                task_id=context.task_id,
                passed=False,
                score=0.0,
                feedback=["No validation scores available"],
                timestamp=time.time()
            )
        
        weighted_score = 0.0
        total_weight = 0.0
        all_feedback = []
        
        for score in all_scores:
            weight = gate_config.criteria_weights.get(score.criterion, 1.0)
            weighted_score += score.score * weight
            total_weight += weight
            all_feedback.extend(score.feedback)
        
        final_score = weighted_score / total_weight if total_weight > 0 else 0.0
        passed = final_score >= gate_config.threshold_score
        
        # Generate summary feedback
        if passed:
            all_feedback.insert(0, f"✅ Quality gate passed with score {final_score:.2f}")
        else:
            all_feedback.insert(0, f"❌ Quality gate failed with score {final_score:.2f} (threshold: {gate_config.threshold_score:.2f})")
        
        return ValidationResult(
            gate_id=gate_config.gate_id,
            task_id=context.task_id,
            passed=passed,
            score=final_score,
            feedback=all_feedback,
            timestamp=time.time()
        )
    
    async def _manual_validation(self, context: ValidationContext, gate_config: QualityGateConfig) -> ValidationResult:
        """Request manual validation via human intervention"""
        if not self.protocol_engine:
            # Cannot request manual validation without protocol engine
            return ValidationResult(
                gate_id=gate_config.gate_id,
                task_id=context.task_id,
                passed=False,
                score=0.0,
                feedback=["Manual validation not available - no protocol engine"],
                timestamp=time.time()
            )
        
        # Send manual validation request
        from .protocol import MessageMetadata
        validation_message = ProtocolMessage(
            type=MessageType.VALIDATION_REQUEST,
            sender=AgentRole.SYSTEM,
            recipient=AgentRole.HUMAN,
            content={
                'validation_type': 'manual_quality_gate',
                'gate_id': gate_config.gate_id,
                'task_id': context.task_id,
                'context': asdict(context),
                'instructions': gate_config.description
            },
            metadata=MessageMetadata(
                task_id=context.task_id,
                timeout_seconds=gate_config.timeout_seconds
            ),
            timestamp=time.time()
        )
        
        await self.protocol_engine.send_message(validation_message)
        
        # For now, return a pending result (in production, would wait for human response)
        return ValidationResult(
            gate_id=gate_config.gate_id,
            task_id=context.task_id,
            passed=False,  # Pending human review
            score=0.0,
            feedback=["Manual validation requested - awaiting human review"],
            timestamp=time.time()
        )
    
    async def _send_validation_result(self, result: ValidationResult):
        """Send validation result via protocol"""
        if not self.protocol_engine:
            return
        
        result_message = ProtocolMessage(
            type=MessageType.QUALITY_RESULT,
            sender=AgentRole.SYSTEM,
            recipient=AgentRole.MANAGER,
            content={
                'validation_result': asdict(result)
            },
            metadata=MessageMetadata(task_id=result.task_id),
            timestamp=time.time()
        )
        
        await self.protocol_engine.send_message(result_message)
    
    def get_quality_metrics(self) -> Dict[str, Any]:
        """Get quality validation metrics"""
        return {
            **self.metrics,
            'success_rate': self.metrics['passed_validations'] / max(1, self.metrics['total_validations']),
            'registered_validators': len(self.validators),
            'registered_gates': len(self.gates),
            'validation_history_size': len(self.validation_history)
        }
    
    def get_validation_history(self, task_id: Optional[str] = None, limit: int = 100) -> List[ValidationResult]:
        """Get validation history"""
        history = self.validation_history
        
        if task_id:
            history = [r for r in history if r.task_id == task_id]
        
        return history[-limit:]

# ============================================================================
# Human Intervention Controllers
# ============================================================================

class HumanInterventionController:
    """
    Controls human intervention workflows for quality oversight.
    
    Features:
    - Intervention request management
    - Approval workflow handling
    - Human feedback integration
    - Escalation procedures
    - Intervention history tracking
    """
    
    def __init__(self, protocol_engine: Optional[ProtocolEngine] = None):
        self.protocol_engine = protocol_engine
        self.active_interventions: Dict[str, Dict[str, Any]] = {}
        self.active_approvals: Dict[str, Dict[str, Any]] = {}
        self.intervention_history: List[Dict[str, Any]] = []
        
        # Metrics
        self.metrics = {
            'total_interventions': 0,
            'resolved_interventions': 0,
            'average_resolution_time': 0.0,
            'escalated_interventions': 0,
            'total_approvals': 0,
            'approved_requests': 0,
            'rejected_requests': 0
        }
    
    async def request_quality_intervention(self, 
                                         task_id: str,
                                         validation_result: ValidationResult,
                                         urgency: str = "normal") -> str:
        """Request human intervention for quality issues"""
        intervention_id = f"quality_{task_id}_{int(time.time())}"
        
        intervention_request = {
            'intervention_id': intervention_id,
            'type': 'quality_review',
            'task_id': task_id,
            'reason': f"Quality validation failed (score: {validation_result.score:.2f})",
            'context': {
                'validation_result': asdict(validation_result),
                'failed_criteria': [fb for fb in validation_result.feedback if '✗' in fb],
                'recommendations': validation_result.recommendations
            },
            'urgency': urgency,
            'requested_at': time.time(),
            'status': 'pending'
        }
        
        self.active_interventions[intervention_id] = intervention_request
        
        # Send intervention request via protocol
        if self.protocol_engine:
            await self._send_intervention_request(intervention_request)
        
        self.metrics['total_interventions'] += 1
        logger.info(f"Quality intervention requested: {intervention_id}")
        
        return intervention_id
    
    async def request_approval(self,
                             task_id: str,
                             action: str,
                             details: Dict[str, Any],
                             timeout_seconds: int = 300) -> str:
        """Request human approval for an action"""
        approval_id = f"approval_{task_id}_{int(time.time())}"
        
        approval_request = {
            'approval_id': approval_id,
            'task_id': task_id,
            'action': action,
            'details': details,
            'requested_at': time.time(),
            'timeout_seconds': timeout_seconds,
            'status': 'pending'
        }
        
        self.active_approvals[approval_id] = approval_request
        
        # Send approval request via protocol
        if self.protocol_engine:
            await self._send_approval_request(approval_request)
        
        self.metrics['total_approvals'] += 1
        logger.info(f"Approval requested: {approval_id} for action: {action}")
        
        return approval_id
    
    async def handle_human_intervention(self,
                                      intervention_id: str,
                                      response: Dict[str, Any]):
        """Handle human intervention response"""
        if intervention_id not in self.active_interventions:
            logger.error(f"Intervention {intervention_id} not found")
            return
        
        intervention = self.active_interventions[intervention_id]
        intervention['response'] = response
        intervention['resolved_at'] = time.time()
        intervention['status'] = 'resolved'
        
        # Calculate resolution time
        resolution_time = intervention['resolved_at'] - intervention['requested_at']
        
        # Update metrics
        self.metrics['resolved_interventions'] += 1
        current_avg = self.metrics['average_resolution_time']
        resolved_count = self.metrics['resolved_interventions']
        self.metrics['average_resolution_time'] = (
            (current_avg * (resolved_count - 1) + resolution_time) / resolved_count
        )
        
        # Move to history
        self.intervention_history.append(intervention.copy())
        del self.active_interventions[intervention_id]
        
        logger.info(f"Human intervention resolved: {intervention_id}")
    
    async def handle_approval_response(self,
                                     approval_id: str,
                                     approved: bool,
                                     reason: str = "",
                                     conditions: Optional[List[str]] = None):
        """Handle approval response"""
        if approval_id not in self.active_approvals:
            logger.error(f"Approval {approval_id} not found")
            return
        
        approval = self.active_approvals[approval_id]
        approval['approved'] = approved
        approval['reason'] = reason
        approval['conditions'] = conditions or []
        approval['resolved_at'] = time.time()
        approval['status'] = 'resolved'
        
        # Update metrics
        if approved:
            self.metrics['approved_requests'] += 1
        else:
            self.metrics['rejected_requests'] += 1
        
        # Move to history (could maintain separate approval history)
        self.intervention_history.append(approval.copy())
        del self.active_approvals[approval_id]
        
        logger.info(f"Approval {'granted' if approved else 'denied'}: {approval_id}")
    
    async def escalate_intervention(self, intervention_id: str, reason: str = ""):
        """Escalate intervention to higher authority"""
        if intervention_id not in self.active_interventions:
            logger.error(f"Intervention {intervention_id} not found for escalation")
            return
        
        intervention = self.active_interventions[intervention_id]
        intervention['escalated'] = True
        intervention['escalation_reason'] = reason
        intervention['escalated_at'] = time.time()
        intervention['urgency'] = 'critical'
        
        self.metrics['escalated_interventions'] += 1
        
        logger.warning(f"Intervention escalated: {intervention_id} - {reason}")
    
    async def _send_intervention_request(self, request: Dict[str, Any]):
        """Send intervention request via protocol"""
        if not self.protocol_engine:
            return
        
        from .protocol import MessageMetadata
        message = ProtocolMessage(
            type=MessageType.HUMAN_INTERVENTION_REQUESTED,
            sender=AgentRole.SYSTEM,
            recipient=AgentRole.HUMAN,
            content=request,
            metadata=MessageMetadata(task_id=request['task_id']),
            timestamp=time.time()
        )
        
        await self.protocol_engine.send_message(message)
    
    async def _send_approval_request(self, request: Dict[str, Any]):
        """Send approval request via protocol"""
        if not self.protocol_engine:
            return
        
        from .protocol import MessageMetadata
        message = ProtocolMessage(
            type=MessageType.APPROVAL_REQUEST,
            sender=AgentRole.SYSTEM,
            recipient=AgentRole.HUMAN,
            content=request,
            metadata=MessageMetadata(
                task_id=request['task_id'],
                timeout_seconds=request['timeout_seconds']
            ),
            timestamp=time.time()
        )
        
        await self.protocol_engine.send_message(message)
    
    def get_intervention_metrics(self) -> Dict[str, Any]:
        """Get intervention metrics"""
        return {
            **self.metrics,
            'resolution_rate': self.metrics['resolved_interventions'] / max(1, self.metrics['total_interventions']),
            'approval_rate': self.metrics['approved_requests'] / max(1, self.metrics['total_approvals']),
            'active_interventions': len(self.active_interventions),
            'active_approvals': len(self.active_approvals),
            'intervention_history_size': len(self.intervention_history)
        }

# Example usage and testing
async def test_quality_framework():
    """Test quality framework functionality"""
    logger.info("=== Quality Framework Test ===")
    
    # Create quality gate manager
    qg_manager = QualityGateManager()
    
    # Create test context
    context = ValidationContext(
        task_id="test-task-001",
        session_id="test-session",
        task_output={
            "files": {
                "main.py": "def hello():\n    return 'Hello World'",
                "test.py": "def test_hello():\n    assert hello() == 'Hello World'"
            },
            "description": "Simple hello world function with test"
        },
        task_requirements=["create hello function", "include tests"],
        code_files=["main.py", "test.py"]
    )
    
    # Test basic quality gate
    result = await qg_manager.validate_task_output(context, "basic_quality")
    logger.info(f"Basic quality validation: {'PASSED' if result.passed else 'FAILED'} (score: {result.score:.2f})")
    
    for feedback in result.feedback:
        logger.info(f"  - {feedback}")
    
    # Test comprehensive quality gate
    result = await qg_manager.validate_task_output(context, "comprehensive_quality")
    logger.info(f"Comprehensive quality validation: {'PASSED' if result.passed else 'FAILED'} (score: {result.score:.2f})")
    
    # Get metrics
    metrics = qg_manager.get_quality_metrics()
    logger.info(f"Quality metrics: {metrics}")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(test_quality_framework())