#!/usr/bin/env python3
"""
Optimized TTS Streaming Service
High-performance text-to-speech with streaming, caching, and real-time metrics
"""

import asyncio
import time
import logging
import hashlib
import json
import threading
from typing import AsyncGenerator, Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict
from collections import defaultdict
from queue import Queue, Empty
import os
import io
import wave
import struct
import psutil
import memory_profiler

# Audio processing
import numpy as np
from scipy import signal
import librosa

# TTS Engines (examples - adjust based on actual engines used)
try:
    import torch
    import torchaudio
    from TTS.api import TTS
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

try:
    import pyttsx3
    PYTTSX3_AVAILABLE = True
except ImportError:
    PYTTSX3_AVAILABLE = False

@dataclass
class TTSMetrics:
    """Performance metrics for TTS operations"""
    request_id: str
    text_length: int
    processing_time: float
    audio_duration: float
    chunk_count: int
    cache_hit: bool
    memory_usage: float
    cpu_usage: float
    latency_ms: float
    throughput_chars_per_sec: float
    
    def to_dict(self) -> Dict:
        return asdict(self)

@dataclass
class AudioChunk:
    """Optimized audio chunk for streaming"""
    data: bytes
    sample_rate: int
    chunk_id: int
    total_chunks: int
    timestamp: float
    is_final: bool = False

class LRUCache:
    """High-performance LRU cache for TTS responses"""
    
    def __init__(self, max_size: int = 100, ttl_seconds: int = 3600):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self.cache = {}
        self.access_order = {}
        self.timestamps = {}
        self.lock = threading.RLock()
    
    def _generate_key(self, text: str, voice: str, rate: float, pitch: float) -> str:
        """Generate cache key from TTS parameters"""
        content = f"{text}|{voice}|{rate}|{pitch}"
        return hashlib.md5(content.encode()).hexdigest()
    
    def get(self, text: str, voice: str, rate: float, pitch: float) -> Optional[bytes]:
        """Get cached audio data"""
        with self.lock:
            key = self._generate_key(text, voice, rate, pitch)
            
            # Check if key exists and is not expired
            if key in self.cache:
                if time.time() - self.timestamps[key] < self.ttl_seconds:
                    # Update access order
                    self.access_order[key] = time.time()
                    return self.cache[key]
                else:
                    # Remove expired entry
                    self._remove_key(key)
            
            return None
    
    def put(self, text: str, voice: str, rate: float, pitch: float, audio_data: bytes):
        """Cache audio data"""
        with self.lock:
            key = self._generate_key(text, voice, rate, pitch)
            
            # Remove oldest entries if cache is full
            while len(self.cache) >= self.max_size:
                oldest_key = min(self.access_order, key=self.access_order.get)
                self._remove_key(oldest_key)
            
            # Add new entry
            self.cache[key] = audio_data
            self.access_order[key] = time.time()
            self.timestamps[key] = time.time()
    
    def _remove_key(self, key: str):
        """Remove key from all data structures"""
        if key in self.cache:
            del self.cache[key]
        if key in self.access_order:
            del self.access_order[key]
        if key in self.timestamps:
            del self.timestamps[key]
    
    def clear(self):
        """Clear all cached entries"""
        with self.lock:
            self.cache.clear()
            self.access_order.clear()
            self.timestamps.clear()
    
    def stats(self) -> Dict:
        """Get cache statistics"""
        with self.lock:
            return {
                'size': len(self.cache),
                'max_size': self.max_size,
                'hit_rate': getattr(self, '_hit_count', 0) / max(getattr(self, '_total_requests', 1), 1),
                'memory_mb': sum(len(data) for data in self.cache.values()) / (1024 * 1024)
            }

class AudioOptimizer:
    """Optimize audio for streaming"""
    
    @staticmethod
    def compress_audio(audio_data: bytes, target_bitrate: int = 64000) -> bytes:
        """Compress audio for faster streaming"""
        try:
            # Convert to numpy array
            audio_array = np.frombuffer(audio_data, dtype=np.int16)
            
            # Apply dynamic range compression
            compressed = AudioOptimizer._dynamic_range_compression(audio_array)
            
            # Reduce bit depth if needed
            if target_bitrate < 128000:
                compressed = AudioOptimizer._reduce_bit_depth(compressed)
            
            return compressed.tobytes()
        except Exception as e:
            logging.warning(f"Audio compression failed: {e}")
            return audio_data
    
    @staticmethod
    def _dynamic_range_compression(audio: np.ndarray, ratio: float = 4.0, threshold: float = 0.1) -> np.ndarray:
        """Apply dynamic range compression"""
        # Simple compressor implementation
        audio_float = audio.astype(np.float32) / 32767.0
        
        # Find samples above threshold
        mask = np.abs(audio_float) > threshold
        
        # Apply compression
        audio_float[mask] = threshold + (audio_float[mask] - threshold) / ratio
        
        return (audio_float * 32767.0).astype(np.int16)
    
    @staticmethod
    def _reduce_bit_depth(audio: np.ndarray) -> np.ndarray:
        """Reduce bit depth for smaller file size"""
        # Simple bit depth reduction
        return (audio // 2).astype(np.int16)
    
    @staticmethod
    def create_optimized_chunks(audio_data: bytes, chunk_size_ms: int = 100) -> List[bytes]:
        """Create optimized audio chunks for streaming"""
        try:
            # Ensure chunk boundaries align with audio frames
            sample_rate = 22050  # Common TTS sample rate
            chunk_size_samples = int(sample_rate * chunk_size_ms / 1000)
            
            # Convert to numpy array
            audio_array = np.frombuffer(audio_data, dtype=np.int16)
            
            chunks = []
            for i in range(0, len(audio_array), chunk_size_samples):
                chunk = audio_array[i:i + chunk_size_samples]
                
                # Apply fade in/out to prevent clicks
                if len(chunk) > 100:  # Only if chunk is large enough
                    fade_samples = min(50, len(chunk) // 4)
                    chunk[:fade_samples] = chunk[:fade_samples] * np.linspace(0, 1, fade_samples)
                    chunk[-fade_samples:] = chunk[-fade_samples:] * np.linspace(1, 0, fade_samples)
                
                chunks.append(chunk.tobytes())
            
            return chunks
            
        except Exception as e:
            logging.warning(f"Chunk optimization failed: {e}")
            # Fallback to simple chunking
            chunk_size_bytes = chunk_size_ms * 44  # Approximate for 22kHz 16-bit
            return [audio_data[i:i + chunk_size_bytes] for i in range(0, len(audio_data), chunk_size_bytes)]

class MetricsCollector:
    """Collect and analyze TTS performance metrics"""
    
    def __init__(self):
        self.metrics: List[TTSMetrics] = []
        self.lock = threading.Lock()
        
    def add_metric(self, metric: TTSMetrics):
        """Add a metric to the collection"""
        with self.lock:
            self.metrics.append(metric)
            
            # Keep only recent metrics (last 1000)
            if len(self.metrics) > 1000:
                self.metrics = self.metrics[-1000:]
    
    def get_performance_stats(self, window_minutes: int = 10) -> Dict:
        """Get performance statistics for the specified time window"""
        with self.lock:
            cutoff_time = time.time() - (window_minutes * 60)
            recent_metrics = [m for m in self.metrics if time.time() - cutoff_time < window_minutes * 60]
            
            if not recent_metrics:
                return {}
            
            latencies = [m.latency_ms for m in recent_metrics]
            throughputs = [m.throughput_chars_per_sec for m in recent_metrics]
            cache_hits = sum(1 for m in recent_metrics if m.cache_hit)
            
            return {
                'total_requests': len(recent_metrics),
                'cache_hit_rate': cache_hits / len(recent_metrics),
                'avg_latency_ms': np.mean(latencies),
                'p95_latency_ms': np.percentile(latencies, 95),
                'p99_latency_ms': np.percentile(latencies, 99),
                'avg_throughput_chars_per_sec': np.mean(throughputs),
                'avg_memory_usage_mb': np.mean([m.memory_usage for m in recent_metrics]),
                'avg_cpu_usage_percent': np.mean([m.cpu_usage for m in recent_metrics])
            }

class OptimizedTTSStreamer:
    """High-performance TTS streaming service"""
    
    def __init__(self, cache_size: int = 500, enable_compression: bool = True):
        self.cache = LRUCache(max_size=cache_size)
        self.metrics_collector = MetricsCollector()
        self.enable_compression = enable_compression
        self.audio_optimizer = AudioOptimizer()
        
        # Initialize TTS engines
        self.engines = self._initialize_engines()
        self.default_engine = 'kokoro'  # Based on task description
        
        # Performance monitoring
        self.process = psutil.Process()
        
        # Streaming settings
        self.chunk_size_ms = 50  # Smaller chunks for lower latency
        self.buffer_size = 3  # Buffer ahead for smooth playback
        
        logging.info(f"TTS Streamer initialized with {len(self.engines)} engines")
    
    def _initialize_engines(self) -> Dict[str, Any]:
        """Initialize available TTS engines"""
        engines = {}
        
        # Kokoro TTS (high-quality, fast)
        try:
            # This would be the actual Kokoro initialization
            # engines['kokoro'] = KokoroTTS()
            engines['kokoro'] = 'kokoro_placeholder'
            logging.info("Kokoro TTS engine loaded")
        except Exception as e:
            logging.warning(f"Failed to load Kokoro TTS: {e}")
        
        # PyTTSx3 as fallback
        if PYTTSX3_AVAILABLE:
            engines['pyttsx3'] = pyttsx3.init()
            engines['pyttsx3'].setProperty('rate', 180)
            logging.info("PyTTSx3 engine loaded")
        
        # Torch-based TTS
        if TORCH_AVAILABLE:
            try:
                # engines['coqui'] = TTS("tts_models/en/ljspeech/tacotron2-DDC")
                engines['coqui'] = 'coqui_placeholder'
                logging.info("Coqui TTS engine loaded")
            except Exception as e:
                logging.warning(f"Failed to load Coqui TTS: {e}")
        
        if not engines:
            raise RuntimeError("No TTS engines available")
        
        return engines
    
    @memory_profiler.profile
    async def synthesize_stream(
        self,
        text: str,
        voice: str = 'default',
        rate: float = 1.0,
        pitch: float = 1.0,
        engine: Optional[str] = None
    ) -> AsyncGenerator[AudioChunk, None]:
        """
        Synthesize text to speech with optimized streaming
        
        Args:
            text: Text to synthesize
            voice: Voice ID
            rate: Speech rate multiplier
            pitch: Pitch multiplier
            engine: TTS engine to use
            
        Yields:
            AudioChunk: Optimized audio chunks for streaming
        """
        request_id = hashlib.md5(f"{text}{voice}{rate}{pitch}{time.time()}".encode()).hexdigest()[:8]
        start_time = time.time()
        start_cpu = self.process.cpu_percent()
        start_memory = self.process.memory_info().rss / 1024 / 1024
        
        try:
            # Check cache first
            cached_audio = self.cache.get(text, voice, rate, pitch)
            cache_hit = cached_audio is not None
            
            if cache_hit:
                audio_data = cached_audio
                logging.debug(f"Cache hit for request {request_id}")
            else:
                # Synthesize audio
                audio_data = await self._synthesize_audio(text, voice, rate, pitch, engine or self.default_engine)
                
                # Cache the result
                self.cache.put(text, voice, rate, pitch, audio_data)
                logging.debug(f"Synthesized and cached audio for request {request_id}")
            
            # Optimize audio if compression is enabled
            if self.enable_compression and not cache_hit:
                audio_data = self.audio_optimizer.compress_audio(audio_data)
            
            # Create optimized chunks
            chunk_data_list = self.audio_optimizer.create_optimized_chunks(
                audio_data, self.chunk_size_ms
            )
            
            # Calculate audio duration
            audio_duration = len(audio_data) / (22050 * 2)  # Assuming 22kHz 16-bit
            
            # Stream chunks
            total_chunks = len(chunk_data_list)
            for i, chunk_data in enumerate(chunk_data_list):
                chunk = AudioChunk(
                    data=chunk_data,
                    sample_rate=22050,
                    chunk_id=i,
                    total_chunks=total_chunks,
                    timestamp=time.time(),
                    is_final=(i == total_chunks - 1)
                )
                
                yield chunk
                
                # Small delay to prevent overwhelming the client
                await asyncio.sleep(0.001)
            
            # Collect metrics
            end_time = time.time()
            processing_time = end_time - start_time
            latency_ms = processing_time * 1000
            throughput = len(text) / processing_time if processing_time > 0 else 0
            
            end_cpu = self.process.cpu_percent()
            end_memory = self.process.memory_info().rss / 1024 / 1024
            
            metric = TTSMetrics(
                request_id=request_id,
                text_length=len(text),
                processing_time=processing_time,
                audio_duration=audio_duration,
                chunk_count=total_chunks,
                cache_hit=cache_hit,
                memory_usage=end_memory - start_memory,
                cpu_usage=(end_cpu + start_cpu) / 2,
                latency_ms=latency_ms,
                throughput_chars_per_sec=throughput
            )
            
            self.metrics_collector.add_metric(metric)
            
            logging.info(f"Request {request_id}: {latency_ms:.1f}ms, {throughput:.1f} chars/sec, cache_hit={cache_hit}")
            
        except Exception as e:
            logging.error(f"TTS synthesis failed for request {request_id}: {e}")
            raise
    
    async def _synthesize_audio(
        self,
        text: str,
        voice: str,
        rate: float,
        pitch: float,
        engine: str
    ) -> bytes:
        """Synthesize audio using the specified engine"""
        
        if engine == 'kokoro':
            return await self._synthesize_kokoro(text, voice, rate, pitch)
        elif engine == 'pyttsx3' and 'pyttsx3' in self.engines:
            return await self._synthesize_pyttsx3(text, voice, rate, pitch)
        elif engine == 'coqui' and 'coqui' in self.engines:
            return await self._synthesize_coqui(text, voice, rate, pitch)
        else:
            raise ValueError(f"Unknown or unavailable TTS engine: {engine}")
    
    async def _synthesize_kokoro(self, text: str, voice: str, rate: float, pitch: float) -> bytes:
        """Synthesize using Kokoro TTS (placeholder implementation)"""
        # This would be the actual Kokoro TTS call
        # For now, generate some dummy audio data
        await asyncio.sleep(0.1)  # Simulate processing time
        
        # Generate sine wave as placeholder
        duration = len(text) * 0.05  # ~50ms per character
        sample_rate = 22050
        t = np.linspace(0, duration, int(sample_rate * duration))
        frequency = 440 * pitch  # A4 note modified by pitch
        audio = (np.sin(2 * np.pi * frequency * t) * 16383).astype(np.int16)
        
        return audio.tobytes()
    
    async def _synthesize_pyttsx3(self, text: str, voice: str, rate: float, pitch: float) -> bytes:
        """Synthesize using PyTTSx3"""
        engine = self.engines['pyttsx3']
        
        # Configure engine
        engine.setProperty('rate', int(180 * rate))
        
        # Create temporary file for audio
        temp_file = f"temp_audio_{int(time.time() * 1000)}.wav"
        
        try:
            engine.save_to_file(text, temp_file)
            engine.runAndWait()
            
            # Read audio data
            with open(temp_file, 'rb') as f:
                # Skip WAV header (44 bytes)
                f.seek(44)
                audio_data = f.read()
            
            return audio_data
        finally:
            # Clean up
            if os.path.exists(temp_file):
                os.remove(temp_file)
    
    async def _synthesize_coqui(self, text: str, voice: str, rate: float, pitch: float) -> bytes:
        """Synthesize using Coqui TTS (placeholder)"""
        # This would be the actual Coqui TTS call
        await asyncio.sleep(0.05)  # Faster than other engines
        
        # Placeholder implementation
        duration = len(text) * 0.04
        sample_rate = 22050
        t = np.linspace(0, duration, int(sample_rate * duration))
        
        # More complex waveform for Coqui
        frequency = 200 * pitch
        audio = np.sin(2 * np.pi * frequency * t) + 0.3 * np.sin(2 * np.pi * frequency * 2 * t)
        audio = (audio * 16383).astype(np.int16)
        
        return audio.tobytes()
    
    def get_performance_metrics(self, window_minutes: int = 10) -> Dict:
        """Get current performance metrics"""
        stats = self.metrics_collector.get_performance_stats(window_minutes)
        cache_stats = self.cache.stats()
        
        return {
            'performance': stats,
            'cache': cache_stats,
            'engines': list(self.engines.keys()),
            'default_engine': self.default_engine,
            'chunk_size_ms': self.chunk_size_ms,
            'compression_enabled': self.enable_compression
        }
    
    def benchmark(self, test_texts: List[str], iterations: int = 5) -> Dict:
        """Run performance benchmark"""
        async def run_benchmark():
            results = []
            
            for text in test_texts:
                text_results = []
                
                for i in range(iterations):
                    start_time = time.time()
                    chunk_count = 0
                    
                    async for chunk in self.synthesize_stream(text):
                        chunk_count += 1
                    
                    end_time = time.time()
                    
                    text_results.append({
                        'iteration': i + 1,
                        'duration': end_time - start_time,
                        'chunk_count': chunk_count,
                        'text_length': len(text)
                    })
                
                results.append({
                    'text': text[:50] + '...' if len(text) > 50 else text,
                    'results': text_results
                })
            
            return results
        
        # Run benchmark
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        benchmark_results = loop.run_until_complete(run_benchmark())
        loop.close()
        
        return {
            'benchmark_results': benchmark_results,
            'test_config': {
                'iterations': iterations,
                'chunk_size_ms': self.chunk_size_ms,
                'compression_enabled': self.enable_compression
            }
        }
    
    def clear_cache(self):
        """Clear the TTS cache"""
        self.cache.clear()
        logging.info("TTS cache cleared")
    
    async def shutdown(self):
        """Graceful shutdown"""
        logging.info("Shutting down TTS streamer")
        self.clear_cache()

# CLI and testing
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Optimized TTS Streamer")
    parser.add_argument("--benchmark", action="store_true", help="Run performance benchmark")
    parser.add_argument("--text", type=str, default="Hello, this is a test of the optimized TTS streaming system.", help="Text to synthesize")
    parser.add_argument("--engine", type=str, default="kokoro", help="TTS engine to use")
    parser.add_argument("--cache-size", type=int, default=500, help="Cache size")
    parser.add_argument("--no-compression", action="store_true", help="Disable audio compression")
    
    args = parser.parse_args()
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    
    async def main():
        # Create TTS streamer
        streamer = OptimizedTTSStreamer(
            cache_size=args.cache_size,
            enable_compression=not args.no_compression
        )
        
        if args.benchmark:
            # Run benchmark
            test_texts = [
                "Short test.",
                "This is a medium length test sentence for TTS performance evaluation.",
                "This is a much longer test sentence that will help us evaluate the performance of the TTS system when processing larger amounts of text, including various punctuation marks, and different sentence structures to ensure comprehensive testing coverage.",
            ]
            
            print("Running benchmark...")
            results = streamer.benchmark(test_texts, iterations=3)
            print(json.dumps(results, indent=2))
        else:
            # Single synthesis test
            print(f"Synthesizing: {args.text}")
            
            start_time = time.time()
            chunk_count = 0
            total_audio_data = b""
            
            async for chunk in streamer.synthesize_stream(args.text, engine=args.engine):
                chunk_count += 1
                total_audio_data += chunk.data
                print(f"Received chunk {chunk.chunk_id + 1}/{chunk.total_chunks} ({len(chunk.data)} bytes)")
            
            end_time = time.time()
            
            print(f"\nSynthesis completed:")
            print(f"  Duration: {(end_time - start_time) * 1000:.1f} ms")
            print(f"  Chunks: {chunk_count}")
            print(f"  Audio data: {len(total_audio_data)} bytes")
            
            # Show performance metrics
            metrics = streamer.get_performance_metrics()
            print(f"\nPerformance metrics:")
            print(json.dumps(metrics, indent=2))
        
        await streamer.shutdown()
    
    # Run the main function
    asyncio.run(main())