#!/usr/bin/env python3
"""
Fix emoji characters in benchmark files for Windows compatibility
"""

import os
import re

# Emoji to text replacements
EMOJI_REPLACEMENTS = {
    '🚀': '[INIT]',
    '📝': '[QUERY]',
    '🔄': '[STREAM]',
    '⚡': '[CONCURRENT]',
    '🧠': '[MEMORY]',
    '🆚': '[COMPARE]',
    '🏁': '[COMPLETE]',
    '📊': '[SUMMARY]',
    '⚠️': '[WARNING]',
    '❌': '[ERROR]',
    '✅': '[SUCCESS]',
    '🎯': '[TARGET]',
    '📦': '[BATCH]',
    '📡': '[STREAMING]',
    '⏳': '[RATE-LIMIT]',
    '🔧': '[TOOL]',
    '🤖': '[MODEL]',
    '⏱️': '[TIMER]',
    '📈': '[METRICS]',
    '🏆': '[BEST]',
    '📬': '[MESSAGES]',
    '❄️': '[COLD]',
    '🔥': '[WARM]',
    '💾': '[DISK]',
    '🔍': '[SEARCH]',
    '⚖️': '[BALANCE]',
    '📄': '[FILE]',
    '🌟': '[STAR]',
    '⭐': '[STAR]',
    '💡': '[IDEA]',
    '🎨': '[ART]',
    '🔑': '[KEY]',
    '🛡️': '[SHIELD]',
    '🚦': '[TRAFFIC]',
    '📋': '[CLIPBOARD]',
    '📌': '[PIN]',
    '🎪': '[CIRCUS]',
    '🎭': '[MASK]',
    '🎬': '[MOVIE]',
    '🎯': '[DART]',
    '🎲': '[DICE]',
    '🎳': '[BOWLING]',
    '⚙️': '[GEAR]',
    '🔩': '[BOLT]',
    '🔨': '[HAMMER]',
    '🪄': '[WAND]',
    '✨': '[SPARKLES]',
    # Unicode escape sequences
    '\U0001f680': '[INIT]',
    '\U0001f4dd': '[QUERY]',
    '\U0001f504': '[STREAM]',
    '\U000026a1': '[CONCURRENT]',
    '\U0001f9e0': '[MEMORY]',
    '\U0001f19a': '[COMPARE]',
    '\U0001f3c1': '[COMPLETE]',
    '\U0001f4ca': '[SUMMARY]',
    '\U000026a0': '[WARNING]',
    '\U0000274c': '[ERROR]',
    '\U00002705': '[SUCCESS]',
    '\U0001f3af': '[TARGET]',
    '\U0001f4e6': '[BATCH]',
    '\U0001f4e1': '[STREAMING]',
    '\U000023f3': '[RATE-LIMIT]',
    '\U0001f527': '[TOOL]',
    '\U0001f916': '[MODEL]',
    '\U000023f1': '[TIMER]',
    '\U0001f4c8': '[METRICS]',
    '\U0001f3c6': '[BEST]',
    '\U0001f4ec': '[MESSAGES]',
    '\U00002744': '[COLD]',
    '\U0001f525': '[WARM]',
    '\U0001f4be': '[DISK]',
    '\U0001f50d': '[SEARCH]',
    '\U0000267e': '[BALANCE]',
}

def fix_file_emojis(filepath):
    """Fix emoji characters in a single file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Replace each emoji/unicode sequence
        for emoji, replacement in EMOJI_REPLACEMENTS.items():
            content = content.replace(emoji, replacement)
        
        # Additional regex patterns for any remaining unicode
        content = re.sub(r'\\U[0-9a-fA-F]{8}', '[UNICODE]', content)
        content = re.sub(r'\\u[0-9a-fA-F]{4}', '[UNICODE]', content)
        
        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Fixed emojis in: {filepath}")
            return True
        else:
            print(f"No emojis found in: {filepath}")
            return False
            
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
    """Fix all emoji characters in benchmark files"""
    print("Fixing emoji characters for Windows compatibility...")
    
    benchmark_dir = os.path.join(os.path.dirname(__file__), 'benchmarks')
    files_fixed = 0
    
    for filename in os.listdir(benchmark_dir):
        if filename.endswith('.py'):
            filepath = os.path.join(benchmark_dir, filename)
            if fix_file_emojis(filepath):
                files_fixed += 1
    
    print(f"\nCompleted! Fixed {files_fixed} files.")

if __name__ == "__main__":
    main()