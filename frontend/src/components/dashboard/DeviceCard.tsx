'use client'

import { Card } from '@nextui-org/react'
import { Button } from '@nextui-org/button'
import Image from 'next/image'
import { useThemeCus } from '@/hooks/useTheme'
import { SummaryResponse } from '@/types/api'
import { useDevice } from '@/hooks/useDeviceStatus'

export function DeviceCard({summary, loading,
    error,}: {summary: SummaryResponse | null, loading: boolean, error: string | null}) {
    const { isDark } = useThemeCus()
    const deviceInfo = summary?.device_info
    const {
        data
    } = useDevice()
    return (
        <Card className="p-8 bg-white ml-6 flex-1 " style={{
            backgroundColor: isDark ? '#1a1a1a' : '#f6f6f6',
            borderRadius: '2rem'
        }}>
            <h2 className="text-2xl  mb-3 text-black underline flex" style={{
                fontSize: '2.075em',
                color: isDark ? '#fff' : '#000'
            }}>{deviceInfo?.name || 'Unknown Device'}   <Image src="/Vector 1.svg" alt="SIGHT Logo" width={20} height={20} className='ml-5' style={{ height: 'auto' }} /></h2>
            <div className="flex items-start gap-1 flex-col mt-3">
                {loading ? (
                    <div>Loading...</div>
                ) : error ? (
                    <div className="text-red-500">{error}</div>
                ) :
                    (
                        <>
                            <div className="flex items-center gap-3">
                                <div className="text-base font-semibold text-black font-ibm-mono" style={{
                                    color: isDark ? '#fff' : '#000',
                                }}>Device</div>
                                <div className="text-base text-black font-ibm-mono" style={{
                                    color: isDark ? '#fff' : '#000',
                                }}>{data?.name || 'Unknown Device'}</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-base font-semibold text-black font-ibm-mono" style={{
                                    color: isDark ? '#fff' : '#000',
                                }}>Status</div>
                                <div className="text-base text-black font-ibm-mono" style={{
                                    color: isDark ? '#fff' : '#000',
                                }}>{data.status}</div>
                            </div>


                            <div className='flex justify-end flex-1 w-full'>
                                <Button
                                    style={{
                                        width: '12rem',
                                        borderRadius: '3rem',
                                        backgroundColor: isDark ? '#fff' : '#000'
                                    }}
                                    className={`flex items-center justify-center gap-5 py-4 px-5 ${'bg-black text-white'}`}
                                    variant="light"
                                    onPress={() => { }}
                                >
                                    <span className="text-base font-medium flex">
                                        <Image src={isDark ? "Group 13.svg" : "/Group 15.svg"} alt="SIGHT Logo" width={25} height={25} className="mr-2" style={{ height: 'auto' }} />
                                        <span style={{
                                            color: isDark ? '#000' : '#fff',

                                        }}>{data.status == 'online' ? 'connected' : 'disconnect'}</span></span>
                                </Button>
                            </div></>)}
            </div>
        </Card>
    )
}