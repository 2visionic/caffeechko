using System;

namespace Dochazka.Api.Models;

public class ApiResponse<T>
{
    public T? Data { get; set; }
    public ApiError? Error { get; set; }
    public ApiMeta? Meta { get; set; } = new ApiMeta();

    public static ApiResponse<T> Success(T data, object? pagination = null)
    {
        return new ApiResponse<T>
        {
            Data = data,
            Error = null,
            Meta = new ApiMeta
            {
                Timestamp = DateTimeOffset.UtcNow,
                Pagination = pagination
            }
        };
    }

    public static ApiResponse<T> Failure(string code, string message, object? details = null)
    {
        return new ApiResponse<T>
        {
            Data = default,
            Error = new ApiError
            {
                Code = code,
                Message = message,
                Details = details
            },
            Meta = new ApiMeta
            {
                Timestamp = DateTimeOffset.UtcNow
            }
        };
    }
}

public class ApiError
{
    public string Code { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public object? Details { get; set; }
}

public class ApiMeta
{
    public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;
    public object? Pagination { get; set; }
}
