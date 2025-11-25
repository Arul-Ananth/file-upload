package org.example.backend.web.dto;

import org.example.backend.file.model.FileResource;

import java.time.OffsetDateTime;

public record FileDto(
        Long id,
        String originalFilename,
        String contentType,
        long size,
        String checksum,
        String storageFilename,
        OffsetDateTime uploadTime,
        long downloadCount
) {
    public static FileDto from(FileResource fr) {
        return new FileDto(
                fr.getId(),
                fr.getOriginalFilename(),
                fr.getContentType(),
                fr.getSize(),
                fr.getChecksum(),
                fr.getStorageFilename(),
                fr.getUploadTime(),
                fr.getDownloadCount()
        );
    }
}
