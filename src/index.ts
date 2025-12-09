import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

// 날씨 코드를 읽기 쉬운 텍스트로 변환하는 함수
function getWeatherDescription(weatherCode: number): string {
    if (weatherCode === 0) return '맑음'
    if (weatherCode >= 1 && weatherCode <= 3) return '대체로 맑음'
    if (weatherCode >= 45 && weatherCode <= 48) return '안개'
    if (weatherCode >= 51 && weatherCode <= 67) return '비/소나기'
    if (weatherCode >= 71 && weatherCode <= 77) return '눈'
    if (weatherCode >= 80 && weatherCode <= 99) return '강한 비/천둥번개'
    return `날씨 코드: ${weatherCode}`
}

// Required: Export default createServer function for Smithery
export default function createServer() {
    const server = new McpServer({
        name: 'my-mcp-server',
        version: '1.0.0'
    })

    server.registerTool(
        'time',
        {
            description: 'timezone을 입력 받아서 현재 시간을 반환합니다.',
            inputSchema: z.object({
                timezone: z.string().describe('timezone')
            })
        },
        async ({ timezone }) => {
            const timezoneString =
                timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
            return {
                content: [
                    {
                        type: 'text',
                        text: `현재 ${timezoneString}의 시간은 ${new Date().toLocaleString(
                            'ko-KR',
                            { timeZone: timezoneString }
                        )}`
                    }
                ]
            }
        }
    )

    server.registerTool(
        'greet',
        {
            description: '이름과 언어를 입력하면 인사말을 반환합니다.',
            inputSchema: z.object({
                name: z.string().describe('인사할 사람의 이름'),
                language: z
                    .enum(['ko', 'en'])
                    .optional()
                    .default('en')
                    .describe('인사 언어 (기본값: en)')
            }),
            outputSchema: z.object({
                content: z
                    .array(
                        z.object({
                            type: z.literal('text'),
                            text: z.string().describe('인사말')
                        })
                    )
                    .describe('인사말')
            })
        },
        async ({ name, language }) => {
            const greeting =
                language === 'ko'
                    ? `안녕하세요, ${name}님!`
                    : `Hey there, ${name}! 👋 Nice to meet you!`

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: greeting
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: greeting
                        }
                    ]
                }
            }
        }
    )

    server.registerTool(
        'calculator',
        {
            description:
                '두 개의 숫자와 연산자를 입력받아 사칙연산을 수행합니다.',
            inputSchema: z.object({
                number1: z.number().describe('첫 번째 숫자'),
                number2: z.number().describe('두 번째 숫자'),
                operator: z
                    .enum(['+', '-', '*', '/'])
                    .describe('연산자 (+, -, *, /)')
            }),
            outputSchema: z.object({
                content: z
                    .array(
                        z.object({
                            type: z.literal('text'),
                            text: z.string().describe('계산 결과')
                        })
                    )
                    .describe('계산 결과')
            })
        },
        async ({ number1, number2, operator }) => {
            let result: number
            let expression: string

            switch (operator) {
                case '+':
                    result = number1 + number2
                    expression = `${number1} + ${number2}`
                    break
                case '-':
                    result = number1 - number2
                    expression = `${number1} - ${number2}`
                    break
                case '*':
                    result = number1 * number2
                    expression = `${number1} × ${number2}`
                    break
                case '/':
                    if (number2 === 0) {
                        return {
                            content: [
                                {
                                    type: 'text' as const,
                                    text: '오류: 0으로 나눌 수 없습니다.'
                                }
                            ],
                            structuredContent: {
                                content: [
                                    {
                                        type: 'text' as const,
                                        text: '오류: 0으로 나눌 수 없습니다.'
                                    }
                                ]
                            }
                        }
                    }
                    result = number1 / number2
                    expression = `${number1} ÷ ${number2}`
                    break
            }

            const resultText = `${expression} = ${result}`

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: resultText
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: resultText
                        }
                    ]
                }
            }
        }
    )

    server.registerTool(
        'geocode',
        {
            description:
                '도시 이름이나 주소를 입력받아 위도, 경도 좌표를 반환합니다.',
            inputSchema: z.object({
                query: z.string().describe('검색할 주소나 도시 이름'),
                limit: z
                    .number()
                    .int()
                    .min(1)
                    .max(10)
                    .optional()
                    .default(1)
                    .describe('반환할 최대 결과 수 (기본값: 1)')
            })
        },
        async ({ query, limit }) => {
            try {
                // Nominatim API 호출
                const baseUrl = 'https://nominatim.openstreetmap.org/search'
                const params = new URLSearchParams({
                    q: query,
                    format: 'jsonv2',
                    limit: limit.toString(),
                    addressdetails: '1'
                })

                const url = `${baseUrl}?${params.toString()}`

                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'MCP-Server/1.0.0'
                    }
                })

                if (!response.ok) {
                    throw new Error(
                        `API 요청 실패: ${response.status} ${response.statusText}`
                    )
                }

                const data = await response.json()

                if (!Array.isArray(data) || data.length === 0) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: `검색 결과를 찾을 수 없습니다: "${query}"`
                            }
                        ]
                    }
                }

                // 결과 포맷팅
                const results = data.slice(0, limit).map((result: any) => {
                    const lat = parseFloat(result.lat)
                    const lon = parseFloat(result.lon)
                    const displayName = result.display_name || query
                    return `주소: ${displayName}, 위도: ${lat}, 경도: ${lon}`
                })

                const resultText =
                    results.length === 1 ? results[0] : results.join('\n')

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: resultText
                        }
                    ]
                }
            } catch (error) {
                const errorMessage =
                    error instanceof Error
                        ? error.message
                        : '알 수 없는 오류가 발생했습니다.'

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: `지오코딩 오류: ${errorMessage}`
                        }
                    ]
                }
            }
        }
    )

    server.registerTool(
        'weather',
        {
            description:
                '위도, 경도 좌표를 입력받아 현재 날씨 정보를 반환합니다.',
            inputSchema: z.object({
                latitude: z
                    .number()
                    .min(-90)
                    .max(90)
                    .describe('위도 (-90 ~ 90)'),
                longitude: z
                    .number()
                    .min(-180)
                    .max(180)
                    .describe('경도 (-180 ~ 180)'),
                timezone: z
                    .string()
                    .optional()
                    .default('auto')
                    .describe('타임존 (기본값: auto)')
            })
        },
        async ({ latitude, longitude, timezone }) => {
            try {
                // Open-Meteo API 호출
                const baseUrl = 'https://api.open-meteo.com/v1/forecast'
                const params = new URLSearchParams({
                    latitude: latitude.toString(),
                    longitude: longitude.toString(),
                    current_weather: 'true',
                    timezone: timezone || 'auto'
                })

                const url = `${baseUrl}?${params.toString()}`

                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'MCP-Server/1.0.0'
                    }
                })

                if (!response.ok) {
                    throw new Error(
                        `API 요청 실패: ${response.status} ${response.statusText}`
                    )
                }

                const data = await response.json()

                if (!data.current_weather) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: '날씨 정보를 가져올 수 없습니다.'
                            }
                        ]
                    }
                }

                const current = data.current_weather
                const units = data.current_weather_units || {}

                // 날씨 정보 포맷팅
                const temperature = current.temperature
                const tempUnit = units.temperature || '°C'
                const weatherDesc = getWeatherDescription(current.weathercode)
                const windSpeed = current.windspeed
                const windSpeedUnit = units.windspeed || 'km/h'
                const windDirection = current.winddirection
                const time = current.time

                const resultText = `위도: ${latitude}, 경도: ${longitude}
현재 온도: ${temperature}${tempUnit}
날씨: ${weatherDesc}
풍속: ${windSpeed} ${windSpeedUnit}
풍향: ${windDirection}°
시간: ${time}`

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: resultText
                        }
                    ]
                }
            } catch (error) {
                const errorMessage =
                    error instanceof Error
                        ? error.message
                        : '알 수 없는 오류가 발생했습니다.'

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: `날씨 정보 조회 오류: ${errorMessage}`
                        }
                    ]
                }
            }
        }
    )

    const systemInfo = {
        platform: process.platform,
        nodeVersion: process.version,
        uptime: process.uptime(),
        memory: {
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
        }
    }

    server.registerResource(
        'system-info',
        'system://info',
        {
            title: '시스템 정보',
            description: '서버의 현재 상태 및 시스템 정보'
        },
        async () => {
            return {
                contents: [
                    {
                        uri: 'system://info',
                        text: JSON.stringify(systemInfo, null, 2)
                    }
                ]
            }
        }
    )

    server.registerPrompt(
        'code-review',
        {
            description: '코드 리뷰를 요청합니다.',
            argsSchema: {
                code: z.string().describe('리뷰할 코드')
            }
        },
        async ({ code }) => {
            return {
                messages: [
                    {
                        role: 'user' as const,
                        content: {
                            type: 'text' as const,
                            text: `다음 코드를 리뷰해주세요:\n\n\`\`\`\n${code}\n\`\`\``
                        }
                    }
                ]
            }
        }
    )

    // Return the server object for Smithery
    return server
}
