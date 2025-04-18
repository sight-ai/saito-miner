'use client'

import { Card } from '@nextui-org/react'
import { Header } from '@/components/Header'
import { MainContent } from '@/components/MainContent'
import { useHistory } from '@/hooks/useHistory'
import { useThemeCus } from '@/hooks/useTheme'
import { Pagination, Select, Tooltip } from 'antd'
import { useState } from 'react'
import { ConfigProvider, theme } from 'antd'
import { useDevice } from '@/hooks/useDevice'

export default function HistoryPage() {
    const { historyItems, loading, error, page, setPage, pageSize, setPageSize, total } = useHistory()
    const { isDark } = useThemeCus()
    const { gatewayStatus } = useDevice()

    const formatRequestId = (requestId: string) => {
        if (requestId.length <= 8) return requestId;
        return `${requestId.slice(0, 4)}...${requestId.slice(-4)}`;
    }

    return (
        <MainContent>
            <main className="flex-1 p-8 space-y-8 bg-white" style={{
                backgroundColor: isDark ? '#000' : '#fff'
            }}>
                <Header></Header>
                <div style={{
                    fontWeight: 800,
                    fontSize: '3.125em',
                    color: isDark ? '#fff' : '#000',
                }}>History</div>
                <Card className="bg-white rounded-lg" style={{
                    backgroundColor: isDark ? '#1a1a1a' : '#f6f6f6'
                }}>
                    <div className="overflow-x-auto pt-3">
                      
                        <table className="min-w-full">
                            <thead>
                                <tr className="flex gap-4" style={{ width: '100%' }}>
                                    <th className="flex-1 px-6 py-3 flex justify-center" style={{ minWidth: '150px' }}>
                                        <div className='text-center text-base font-bold text-white bg-black rounded-lg' style={{ width: 130, padding: 10, borderRadius: 30, backgroundColor: '#000', color: '#fff' }}>
                                            Request ID
                                        </div>
                                    </th>
                                    <th className="flex-1 px-6 py-3 flex justify-center" style={{ minWidth: '120px' }}>
                                        <div className='text-center text-base font-bold text-white bg-black rounded-lg' style={{ width: 100, padding: 10, borderRadius: 30, backgroundColor: '#000', color: '#fff' }}>
                                            Status
                                        </div>
                                    </th>
                                    <th className="flex-1 px-6 py-3 flex justify-center" style={{ minWidth: '120px' }}>
                                        <div className='text-center text-base font-bold text-white bg-black rounded-lg' style={{ width: 100, padding: 10, borderRadius: 30, backgroundColor: '#000', color: '#fff' }}>
                                            Model
                                        </div>
                                    </th>
                                    <th className="flex-1 px-6 py-3 flex justify-center" style={{ minWidth: '150px' }}>
                                        <div className='text-center text-base font-bold text-white bg-black rounded-lg' style={{ width: 130, padding: 10, borderRadius: 30, backgroundColor: '#000', color: '#fff' }}>
                                            Token Usage
                                        </div>
                                    </th>
                                    <th className="flex-1 px-6 py-3 flex justify-center" style={{ minWidth: '120px' }}>
                                        <div className='text-center text-base font-bold text-white bg-black rounded-lg' style={{ width: 100, padding: 10, borderRadius: 30, backgroundColor: '#000', color: '#fff' }}>
                                            Reward
                                            {!gatewayStatus.isRegistered && (
                                                <Tooltip 
                                                    title={
                                                        <div>
                                                            <p style={{ color: '#ff4d4f' }}>This is an estimate reward. 
                                                           </p>
                                                            <a href="https://sightai.io/model/gateway" target="_blank" style={{ color: '#1890ff' }}> Connect gateway to see actual rewards!</a>
                                                        </div>
                                                    }
                                                    color={isDark ? '#1a1a1a' : '#fff'}
                                                >
                                                    <span style={{ 
                                                        marginLeft: '8px', 
                                                        cursor: 'pointer',
                                                        color: '#ff4d4f'
                                                    }}>?</span>
                                                </Tooltip>
                                            )}
                                        </div>
                                    </th>
                                    <th className="flex-1 px-6 py-3 flex justify-center" style={{ minWidth: '120px' }}>
                                        <div className='text-center text-base font-bold text-white bg-black rounded-lg' style={{ width: 100, padding: 10, borderRadius: 30, backgroundColor: '#000', color: '#fff' }}>
                                            Source
                                        </div>
                                    </th>
                                    <th className="flex-1 px-6 py-3 flex justify-center" style={{ minWidth: '120px' }}>
                                        <div className='text-center text-base font-bold text-white bg-black rounded-lg' style={{ width: 100, padding: 10, borderRadius: 30, backgroundColor: '#000', color: '#fff' }}>
                                            Time
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            {loading && <div className="p-4 text-center">loading...</div>}
                            {error && <div className="p-4 text-center text-red-500">{error}</div>}
                            <tbody>
                                {historyItems.map((item, index) => (
                                    <tr key={index} className="flex gap-4" style={{ width: '100%' }}>
                                        <td className="flex-1 px-6 py-4 text-center text-base" style={{ minWidth: '150px', color: isDark ? '#fff' : '#000' }}>
                                            {formatRequestId(item.requestId)}
                                        </td>
                                        <td className="flex-1 px-6 py-4 text-center text-base" style={{ minWidth: '120px' }}>
                                            <div
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    padding: '6px 16px',
                                                    borderRadius: '999px',
                                                    fontWeight: 'bold',
                                                    fontSize: '14px',
                                                    minWidth: 100,
                                                    justifyContent: 'center',
                                                    background: item.status === 'In-Progress'
                                                        ? 'linear-gradient(90deg, #B06AB3, #FFA07A)'
                                                        : isDark ? '#1a1a1a' : '#efefef',
                                                    color: isDark 
                                                        ? item.status === 'In-Progress' ? '#fff' : '#fff' 
                                                        : '#000',
                                                }}
                                            >
                                                {item.status !== 'In-Progress' && (
                                                    <span
                                                        style={{
                                                            width: '8px',
                                                            height: '8px',
                                                            borderRadius: '50%',
                                                            backgroundColor: item.status === 'Done' ? '#00c853' : '#d50000',
                                                            marginRight: '6px'
                                                        }}
                                                    />
                                                )}
                                                {item.status}
                                            </div>
                                        </td>
                                        <td className="flex-1 px-6 py-4 text-center text-base" style={{ minWidth: '120px' }}>
                                            <div style={{
                                                display: 'inline-block',
                                                padding: '4px 12px',
                                                borderRadius: '4px',
                                                backgroundColor: '#f0f0f0',
                                                color: '#000',
                                                fontSize: '14px'
                                            }}>
                                                {item.model}
                                            </div>
                                        </td>
                                        <td className="flex-1 px-6 py-4 text-center text-base" style={{ minWidth: '150px', color: isDark ? '#fff' : '#000' }}>
                                            {item.tokenUsage}
                                        </td>
                                        <td className="flex-1 px-6 py-4 text-center text-base" style={{ minWidth: '120px', color: isDark ? '#fff' : '#000' }}>
                                            {item.reward}
                                        </td>
                                        <td className="flex-1 px-6 py-4 text-center text-base" style={{ minWidth: '120px' }}>
                                            <div style={{
                                                display: 'inline-block',
                                                padding: '4px 12px',
                                                borderRadius: '4px',
                                                backgroundColor: item.source === 'local' ? (isDark ? '#2d2d2d' : '#f0f0f0') : (isDark ? '#1a3a1a' : '#e6f7e6'),
                                                color: item.source === 'local' ? (isDark ? '#fff' : '#000') : (isDark ? '#4caf50' : '#2e7d32'),
                                                fontSize: '14px',
                                                fontWeight: '500'
                                            }}>
                                                {item.source === 'local' ? 'Local' : 'Gateway'}
                                            </div>
                                        </td>
                                        <td className="flex-1 px-6 py-4 text-center text-base" style={{ minWidth: '120px', color: isDark ? '#fff' : '#000' }}>
                                            {new Date(item.updated_at).toLocaleString('en-US', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                hour12: false,
                                            })}
                                            <br />
                                            {new Date(item.updated_at).toLocaleDateString('en-US', {
                                                month: '2-digit',
                                                day: '2-digit',
                                                year: 'numeric'
                                            })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div style={{
                            padding: '1rem',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderTop: `1px solid ${isDark ? '#333' : '#eee'}`
                        }}>
                            <ConfigProvider
                                theme={{
                                    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
                                    token: {
                                        colorText: isDark ? '#fff' : '#000',
                                        colorTextBase: isDark ? '#fff' : '#000',
                                        colorBgContainer: isDark ? '#1a1a1a' : '#fff',
                                        colorBorder: isDark ? '#333' : '#d9d9d9',
                                        colorPrimary: isDark ? '#fff' : '#000',
                                        colorPrimaryHover: isDark ? '#ccc' : '#333',
                                        colorPrimaryActive: isDark ? '#fff' : '#000',
                                        colorPrimaryText: isDark ? '#000' : '#fff',
                                    },
                                    components: {
                                        Pagination: {
                                            colorBgContainer: 'transparent',
                                            colorBgTextHover: isDark ? '#333' : '#f5f5f5',
                                            colorBgTextActive: isDark ? '#fff' : '#000',
                                            colorText: isDark ? '#fff' : '#000',
                                            colorPrimary: isDark ? '#fff' : '#000',
                                            colorTextDisabled: isDark ? '#666' : '#999',
                                        },
                                        Select: {
                                            colorBgContainer: isDark ? '#1a1a1a' : '#fff',
                                            colorBgElevated: isDark ? '#1a1a1a' : '#fff',
                                            colorText: isDark ? '#fff' : '#000',
                                            colorTextPlaceholder: isDark ? '#666' : '#999',
                                            controlItemBgActive: isDark ? '#333' : '#f5f5f5',
                                            controlItemBgHover: isDark ? '#333' : '#f5f5f5',
                                        }
                                    }
                                }}
                            >
                                <Pagination
                                    current={page}
                                    pageSize={pageSize}
                                    total={total}
                                    showSizeChanger
                                    pageSizeOptions={[10, 20, 50]}
                                    onChange={(page, size) => {
                                        setPage(page)
                                        setPageSize(size)
                                    }}
                                />
                            </ConfigProvider>
                        </div>
                    </div>
                </Card>
            </main>
        </MainContent>
    )
}