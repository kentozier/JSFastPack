// JSFastPack removes comments and extraneous whitespace  
// from Javascript source files. Particular attention was given
// towards tuning code making it as fast as possible. In tests
// it packing rates of between 5 MB and 15 MB per second.
function JSFastPack(inString)
{
	var i			= 0;
	var result		= '';
	var ch;
	var code;
	var lastType;
	var lastChar;
	var delim;
	
	// Without some form of context tracking, detecting 
	// regular expressions, character by character, 
	// is really cumbersome, so before doing anything 
	// else, temporarily encode them as base64 strings 
	// bounded with '<re_' start and '>' end delimiters. 
	// In this form, they can be easily detected during 
	// packing and restored to their original value.
	// The reason this extra step is necessary is that
	// the packing algorithm is specifically designed 
	// to remove as much whitespace as possible which,
	// if applied within regular expressions, could 
	// potentially change what they do.
	
	var encodeMatch	= function(inMatch)
	{
		var prefix;
		var exp;
		var index;
	
		if (inMatch.charAt(0) == '=')
		{
			// regex assigned to variable
			// ex: re	= /[a-z]+/g;
			index	= inMatch.indexOf('/');
			prefix	= inMatch.slice(0, index);
			exp		= inMatch.substring(index);
		}
		else
		{
			// regex defined in function
			// ex: str.match(/[a-z]+/g);
			index	= inMatch.indexOf('(');
			prefix	= inMatch.slice(0, index + 1);
			exp		= inMatch.substring(index + 1);
		}
	
		return prefix + '<re_' + Base64EncodeString(exp) + '>';
	}
	
	var re			= /(=\s+|\.(match|test|exec|search|replace|split)\()(\/.+\/)([gimy]+)?/g;
	var src			= inString.replace(re, encodeMatch);
	var len			= src.length;
	
	while (i < len)
	{
		// fetching just char code is about 4 percent faster,
		// on average, than fetching both char code 
		// and char together.
		code		= src.charCodeAt(i);
		
		if (code == 47)		// '/'
		{
			// might be a comment start, test next char
			if (src.charCodeAt(i + 1) == 47)	// '/'
			{
				// single line comment start, skip it
				i += 2;
				while (i < len)
				{
					ch			= src.charAt(i++);
		
					if ((ch == '\r') ||
						(ch == '\n'))
					{
						// comment end found, break out of loop
						break;
					}
				}
			}
			else if (src.charCodeAt(i + 1) == 42)	// '*'
			{
				// multi line comment start, skip it
				i += 2;
				while (i < len)
				{
					if ((src.charAt(i++) == '*') &&
						(src.charAt(i) == '/'))
					{
						// comment end found, break out of loop
						i++;
						break;
					}
				}
			}
			else
			{
				// not a comment, add char to result
				result		+= src.charAt(i++);
				lastType	= 'c';
			}
		}
		// detecting and decoding previously encoded base64 regexes, 
		// on-the-fly is roughly 9 percent faster than decoding 
		// them with a dedicated function after packing
		else if (code == 60)	// '<'
		{
			// might be encoded regular expression
			if ((i + 4) < len)
			{
				// test for encoding prefix
				if ((src.charAt(i + 1) == 'r') &&
					(src.charAt(i + 2) == 'e') &&
					(src.charAt(i + 3) == '_'))
				{
					// encoded regular expression, decode it
					var re		= '';
					
					// skip '<re_' encoding start delim 
					i += 4;
					
					// loop until encoding end delim (>) is found
					while (i < len)
					{
						ch	= src.charAt(i++);
						if (ch == '>')
							break;
						else
							re	+= ch;
					}
					
					// decode expression and add to result
					result		+= Base64DecodeString(re);
					lastType	= 'c';
				}
				else
				{
					// not the '<re_' encoding prefix, just add char
					result		+= src.charAt(i++);
					lastType	= 'c';
				}
			}
			else
			{
				// not enough room for encoded prefix. just add char
				result		+= src.charAt(i++);
				lastType	= 'c';
			}
		}
		else if ((code == 34) ||	// double quote
				 (code == 39))		// single quote
		{
			// string start, pack it
			delim		= src.charAt(i++);
			result		+= delim;
	
			while (i < len)
			{
				ch		= src.charAt(i++);

				if ((ch == '\\') &&
					(lastChar == '\\'))
				{
					// void char value (prevents erroneous escapes) 
					ch	= undefined;
				}
				else if ((ch == delim) &&
					(lastChar != '\\'))
				{
					// found string end, break out of loop
					result		+= delim;
					lastType	= 'c';
					break;
				}
				else
					result	+= ch;

				lastChar = ch;
			}
			lastType	= 'c';
		}
		// testing code ranges is about 4 percent 
		// faster, on average, than using indexOf 
		// on a string containing code chars
		else if (((code > 34) && (code < 39))	||	// # $ % &
			((code > 39) && (code < 48)) 		||	// ( ) * + , - . /
			((code > 57) && (code < 65)) 		||	// : ; < = > ? @
			((code > 90) && (code < 97)) 		||	// [ \ ] ^ _ `
			((code > 122) && (code < 127)) 		||	// { \ } ~
			(code == 33))							// !	
		{
			// code char, add it
			result		+= src.charAt(i++);
			lastType	= 'c';
		}
		// testing whitespace code range is about 7
		// percent faster, on average, than testing
		// individual whitespace chars
		else if (((code > 8) &&
				 (code < 14)) ||
				 (code == 32))
		{
			// white char, skip it
			i++;
			while (i < len)
			{
				code	= src.charCodeAt(i);
				if (((code > 8) &&
					(code < 14)) ||
					(code == 32))
					i++;
				else
					 break;
			}
			
			if (lastType != 'c')
				lastType	= 'w';
		}
		else
		{
			if (lastType == 'w')
				result		+= ' ';
				
			result		+= src.charAt(i++);
			lastType	= 'n';
		}
	}
	
	return result;
}

function Base64EncodeString(inString)
{
	var str			= inString;
	var remainder	= str.length % 3;
	var tripleEnd	= Math.floor(str.length / 3) * 3;
	var result		= "";
	var pad			= '=';
	var i			= 0;
				
	// process complete triples
	while (i < tripleEnd)
	{
		result	+= String.fromCharCode(Base64EncodeChar((str.charCodeAt(i) >> 2) & 0x3F));
		result	+= String.fromCharCode(Base64EncodeChar((str.charCodeAt(i) << 4) & 0x30 | (str.charCodeAt(++i) >> 4) & 0x0F));
		result	+= String.fromCharCode(Base64EncodeChar((str.charCodeAt(i) << 2) & 0x3C | (str.charCodeAt(++i) >> 6) & 0x03));
		result	+= String.fromCharCode(Base64EncodeChar( str.charCodeAt(i) & 0x3F));
		i++;
	}

	// process triple fragments
	if (remainder == 2)
	{
		// add one pad char
		result	+= String.fromCharCode(Base64EncodeChar((str.charCodeAt(i) >> 2) & 0x3F));
		result	+= String.fromCharCode(Base64EncodeChar((str.charCodeAt(i) << 4) & 0x30 | (str.charCodeAt(++i) >> 4) & 0x0F));
		result	+= String.fromCharCode(Base64EncodeChar((str.charCodeAt(i) << 2) & 0x3C));
		result	+= pad;
	}
	else if (remainder == 1)
	{
		// add two pad chars
		result	+= String.fromCharCode(Base64EncodeChar((str.charCodeAt(i) >> 2) & 0x3F));
		result	+= String.fromCharCode(Base64EncodeChar((str.charCodeAt(i) << 4) & 0x30));
		result	+= pad;
		result	+= pad;
	}

	return result;
}

function Base64EncodeChar(inChar)
{
	if (inChar < 26)			// A-Z	= 0 - 25
		return inChar + 65;
	else if (inChar < 52)		// a-z	= 26 - 51
		return inChar + 71;
	else if (inChar < 62) 		// 0-9	= 52 - 61
		return inChar - 4;
	else if (inChar == 62)		// '+'
		return 43;		
	else
		return 47;				// '/'
}

function Base64DecodeString(inString)
{
	var str			= inString;
	var tlen		= str.length;
	var pad1		= '=';
	var pad2		= ' ';
	var result		= "";
	var i			= 0;
	var code1, code2;
	
	while (i < tlen)
	{
		// build the first char
		code1	= (Base64DecodeChar(str.charCodeAt(i))		<< 2) & 0xFC;
		code2	= (Base64DecodeChar(str.charCodeAt(++i))	>> 4) & 0x03;
		result 	+=  String.fromCharCode(code1 | code2);
		if ((str.charAt(i + 1) == pad1) || (str.charAt(i + 1) == pad2)) break;
		
		// build the second char
		code1	= (Base64DecodeChar(str.charCodeAt(i))		<< 4) & 0xF0;
		code2	= (Base64DecodeChar(str.charCodeAt(++i))	>> 2) & 0x0F;
		result 	+= String.fromCharCode(code1 | code2);
		if ((str.charAt(i + 1) == pad1) || (str.charAt(i + 1) == pad2)) break;
		
		// build the third char
		code1	= (Base64DecodeChar(str.charCodeAt(i))		<< 6) & 0xC0;
		code2	=  Base64DecodeChar(str.charCodeAt(++i)) 		  & 0x3F;
		result 	+= String.fromCharCode(code1 | code2);
		
		i++;
	}
	
	return result;
}

function Base64DecodeChar(inChar)
{
	if (inChar == 43)			// '+'
		return 62;
	else if (inChar == 47)		// '/'
		return 63;
	else if (inChar < 58) 		// 0-9	= 52 - 61
		return inChar + 4;
	else if (inChar < 91)		// A-Z	= 0 - 25
		return inChar - 65;
	else
		return inChar - 71;		// a-z	= 26 - 51
}
